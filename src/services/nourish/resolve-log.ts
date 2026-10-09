import {
  getDescriptionAiProvider,
  type DescriptionAiProvider,
} from "@/services/meal-description-ai-provider";
import {
  resolveMealDescriptionWithProviderStaged,
} from "@/services/meal-description-resolution-flow";
import {
  matchSavedFood,
  resolveSegmentLocally,
} from "@/services/meal-food-resolution";
import {
  parseLeadingQuantity,
  splitDescriptionSegments,
} from "@/services/meal-description-parsing";
import {
  checkCountables,
  localFoodItems,
  reconcileEnergy,
} from "@/services/nourish/local-food";
import {
  findFoodDefinition,
  calculateFoodMacros,
} from "@/data/foods";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import { pickMicronutrients, type EstimatedFood } from "@/types/gymos";
import type { DraftItem, DraftSource } from "@/types/nourish";

/** How much to trust each source. Catalog values are exact for a stated
 *  portion; the user's own saved numbers are what they confirmed before;
 *  AI and typical-value guesses are estimates. */
const CONFIDENCE: Record<DraftSource, number> = {
  saved: 0.9,
  catalog: 0.85,
  ai: 0.6,
  local: 0.6,
  manual: 0.95,
};

/** Restaurant portions and cooking fat are unknowable from a sentence, so
 *  nothing logged while eating out is presented as better than a guess. */
const EATING_OUT_CEILING = 0.5;

export const LOCAL_ESTIMATE_NOTICE =
  "Estimated from typical values, please check";

export type ResolveOutcome =
  | { status: "empty" }
  | {
      status: "ready";
      items: DraftItem[];
      /** Shown above the review list when something needs a second look. */
      notice?: string;
    }
  | {
      status: "manual";
      /** The text to pre-fill in the manual entry form. */
      name: string;
      reason: "unreadable" | "unavailable";
    };

export type SegmentStatus = "matched" | "estimated" | "needs-input";

export type SegmentResolution = {
  segment: string;
  status: SegmentStatus;
  item?: DraftItem;
  reason?: string;
};

function formatAmount(amount: number): string {
  return String(Math.round(amount * 100) / 100);
}

function fromEstimated(food: EstimatedFood): DraftItem {
  const source: DraftSource =
    food.nutritionSource === "food-db"
      ? "catalog"
      : food.nutritionSource === "manual"
        ? "saved"
        : "ai";

  return {
    name: food.name,
    qty: `${formatAmount(food.estimatedAmount)} ${food.unit}`.trim(),
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    ...pickMicronutrients(food),
    confidence: CONFIDENCE[source],
    multiplier: 1,
    source,
    ...(food.entryId ? { entryId: food.entryId } : {}),
  };
}

/** A saved food as a reviewable item (its own portion and numbers). */
export function savedFoodToDraft(saved: SavedFood): DraftItem {
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    name: saved.name,
    qty: saved.qty ?? "1 serving",
    calories: number(saved.calories),
    protein: number(saved.protein),
    carbs: number(saved.carbs),
    fat: number(saved.fat),
    ...pickMicronutrients(saved),
    confidence: CONFIDENCE.saved,
    multiplier: 1,
    source: "saved",
  };
}

/** A bare name ("dal") that matches something the user saved is resolved
 *  from THEIR numbers. A typed quantity ("3 eggs") is never matched this
 *  way, because the saved numbers describe one usual portion. */
function matchUsualFood(
  segment: string,
  saved: readonly SavedFood[],
): SavedFood | undefined {
  const parsed = parseLeadingQuantity(segment);

  if (parsed.amount !== undefined) return undefined;

  return matchSavedFood(segment, [...saved]);
}

function finalize(items: DraftItem[], eatingOut: boolean): DraftItem[] {
  const sane = reconcileEnergy(checkCountables(items));

  return eatingOut
    ? sane.map((item) => ({
        ...item,
        confidence: Math.min(item.confidence, EATING_OUT_CEILING),
      }))
    : sane;
}

/** Resolve leftover segments with no network: catalog → ingredients table → typical values. */
function resolveOffline(
  segments: readonly string[],
  saved: readonly SavedFood[],
): { items: DraftItem[]; usedTypicalValues: boolean } | null {
  const items: DraftItem[] = [];
  let usedTypicalValues = false;

  for (const segment of segments) {
    const local = resolveSegmentLocally(segment, [...saved]);

    if (!local.unresolved) {
      items.push(fromEstimated(local));
      continue;
    }

    const parsed = parseLeadingQuantity(segment);
    const def = findFoodDefinition(parsed.name);
    if (def) {
      const amount = parsed.amount !== undefined ? parsed.amount : 1;
      const macros = calculateFoodMacros(def, amount, parsed.unit, parsed.size);
      const unitLabel = parsed.unit
        ? parsed.unit
        : def.pieceG
          ? amount === 1
            ? "piece"
            : "pieces"
          : "serving";
      const formattedQty = `${formatAmount(amount)} ${unitLabel}`.trim();
      items.push({
        name: def.name,
        qty: formattedQty,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        confidence: 0.8,
        multiplier: 1,
        source: "local",
      });
      usedTypicalValues = true;
      continue;
    }

    const typical = localFoodItems(segment);

    if (!typical) return null;

    usedTypicalValues = true;
    items.push(...typical);
  }

  return { items, usedTypicalValues };
}

/**
 * Return per-segment resolution results for Kitchen and detailed reviews.
 * Does not fail all-or-nothing: unresolved ingredients return status: "needs-input".
 */
export async function resolveSegments(
  text: string,
  options?: {
    saved?: readonly SavedFood[];
    eatingOut?: boolean;
    provider?: DescriptionAiProvider | null;
  },
): Promise<SegmentResolution[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const saved = options?.saved ?? [];
  const rawSegments = splitDescriptionSegments(trimmed);
  const results: SegmentResolution[] = [];

  const provider =
    options?.provider === undefined
      ? getDescriptionAiProvider()
      : options.provider;

  for (const segment of rawSegments) {
    // 1. Saved food for bare names
    const usual = matchUsualFood(segment, saved);
    if (usual) {
      results.push({
        segment,
        status: "matched",
        item: savedFoodToDraft(usual),
      });
      continue;
    }

    // 2. Exact catalog match from food-db
    const local = resolveSegmentLocally(segment, [...saved]);
    if (!local.unresolved) {
      results.push({
        segment,
        status: "matched",
        item: fromEstimated(local),
      });
      continue;
    }

    // 3. Extended ingredient table match
    const parsed = parseLeadingQuantity(segment);
    const def = findFoodDefinition(parsed.name);
    if (def) {
      const amount = parsed.amount !== undefined ? parsed.amount : 1;
      const macros = calculateFoodMacros(def, amount, parsed.unit, parsed.size);
      const unitLabel = parsed.unit
        ? parsed.unit
        : def.pieceG
          ? amount === 1
            ? "piece"
            : "pieces"
          : "serving";
      const formattedQty = `${formatAmount(amount)} ${unitLabel}`.trim();

      results.push({
        segment,
        status: "estimated",
        item: {
          name: def.name,
          qty: formattedQty,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          confidence: 0.8,
          multiplier: 1,
          source: "local",
        },
      });
      continue;
    }

    // 4. Typical values
    const typical = localFoodItems(segment);
    if (typical && typical.length > 0) {
      results.push({
        segment,
        status: "estimated",
        item: typical[0],
      });
      continue;
    }

    // 5. AI provider if available
    if (provider) {
      try {
        const aiEst = await provider.estimate(segment);
        if (aiEst.foods.length > 0 && !aiEst.foods[0]!.unresolved) {
          results.push({
            segment,
            status: "estimated",
            item: fromEstimated(aiEst.foods[0]!),
          });
          continue;
        }
      } catch {
        // Fall through to needs-input
      }
    }

    // 6. Unresolved / Needs input
    const cleanName = parsed.name || segment;
    results.push({
      segment,
      status: "needs-input",
      reason: cleanName ? `Don't know '${cleanName}' yet` : "No amount given",
      item: {
        name: cleanName,
        qty: parsed.unit
          ? `${formatAmount(parsed.amount ?? 1)} ${parsed.unit}`
          : "1 serving",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidence: 0,
        multiplier: 1,
        source: "manual",
      },
    });
  }

  return results;
}

/**
 * Turn a typed sentence ("2 rotis, dal, paneer bhurji") into reviewable
 * items. Order of trust:
 *   1. the user's own saved foods, for bare names
 *   2. the AI proxy (when configured) for everything else, with catalog
 *      values taking precedence for exact catalog matches
 *   3. offline: the food catalog, then extended ingredients, then typical staples
 * If any piece can't be resolved by any of these, the whole entry falls
 * back to manual entry rather than silently dropping a food.
 */
export async function resolveLogText(
  text: string,
  options: {
    saved: readonly SavedFood[];
    eatingOut?: boolean;
    /** Undefined = use the configured proxy; null = force offline. */
    provider?: DescriptionAiProvider | null;
  },
): Promise<ResolveOutcome> {
  const trimmed = text.trim();

  if (!trimmed) return { status: "empty" };

  const eatingOut = options.eatingOut === true;
  const segments = splitDescriptionSegments(trimmed);

  if (segments.length === 0) return { status: "empty" };

  const fromUser: DraftItem[] = [];
  const remaining: string[] = [];

  for (const segment of segments) {
    const usual = matchUsualFood(segment, options.saved);

    if (usual) fromUser.push(savedFoodToDraft(usual));
    else remaining.push(segment);
  }

  if (remaining.length === 0) {
    return { status: "ready", items: finalize(fromUser, eatingOut) };
  }

  const provider =
    options.provider === undefined
      ? getDescriptionAiProvider()
      : options.provider;
  const remainingText = remaining.join(", ");

  if (provider) {
    const result = await resolveMealDescriptionWithProviderStaged(
      remainingText,
      undefined,
      undefined,
      [...options.saved],
      provider,
    );

    if (result.status === "resolved") {
      const items = [
        ...fromUser,
        ...result.estimate.foods.map(fromEstimated),
      ];

      return { status: "ready", items: finalize(items, eatingOut) };
    }
    // AI failed or returned nothing usable: fall through to offline.
  }

  const offline = resolveOffline(remaining, options.saved);

  if (!offline) {
    return {
      status: "manual",
      name: trimmed,
      reason: provider ? "unreadable" : "unavailable",
    };
  }

  return {
    status: "ready",
    items: finalize([...fromUser, ...offline.items], eatingOut),
    ...(offline.usedTypicalValues ? { notice: LOCAL_ESTIMATE_NOTICE } : {}),
  };
}
