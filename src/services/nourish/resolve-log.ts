import {
  getDescriptionAiProvider,
  type DescriptionAiProvider,
} from "@/services/meal-description-ai-provider";
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
import {
  isSameUnit,
  matchFoodEntry,
  scalePortionMacros,
} from "@/services/food-db";
import { getStorage, setStorage } from "@/storage/storage";
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

/** AI Estimate Cache keyed by normalized description segment. Stored in memory and AsyncStorage. */
const AI_ESTIMATE_CACHE_KEY = "@gymos/ai-estimate-cache";
let memoryAiCache: Map<string, DraftItem> | null = null;

async function getAiCache(): Promise<Map<string, DraftItem>> {
  if (memoryAiCache) return memoryAiCache;
  memoryAiCache = new Map();
  try {
    const raw = await getStorage<Record<string, DraftItem>>(AI_ESTIMATE_CACHE_KEY);
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        if (v && typeof v === "object" && "name" in v && "calories" in v) {
          memoryAiCache.set(k, v as DraftItem);
        }
      }
    }
  } catch {
    // Ignore cache load errors
  }
  return memoryAiCache;
}

async function setAiCache(key: string, item: DraftItem): Promise<void> {
  const cache = await getAiCache();
  cache.set(key, item);
  try {
    const obj: Record<string, DraftItem> = {};
    for (const [k, v] of cache.entries()) {
      obj[k] = v;
    }
    await setStorage(AI_ESTIMATE_CACHE_KEY, obj);
  } catch {
    // Ignore cache write errors
  }
}

/** Sanity / plausibility check on AI response */
export function isPlausibleItem(item: DraftItem): boolean {
  if (item.calories < 0 || item.calories > 3000) return false;
  if (item.protein < 0 || item.protein > 200) return false;
  if (item.carbs < 0 || item.carbs > 400) return false;
  if (item.fat < 0 || item.fat > 200) return false;
  return true;
}

/** Lenient validation of AI response: fills missing fields with 0 */
export function lenientDraftFromEstimate(food: EstimatedFood): DraftItem {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const draft = fromEstimated({
    ...food,
    calories: num(food.calories),
    protein: num(food.protein),
    carbs: num(food.carbs),
    fat: num(food.fat),
  });

  // Recompute calories if macros disagree wildly (reconcile)
  const calcCal = Math.round(4 * draft.protein + 4 * draft.carbs + 9 * draft.fat);
  if (draft.calories === 0 && calcCal > 0) {
    draft.calories = calcCal;
  }
  return draft;
}

/** Resolve a single segment with 1 retry and 12s timeout */
async function fetchWithRetry(
  segment: string,
  provider: DescriptionAiProvider,
): Promise<EstimatedFood | null> {
  const singleAttempt = async () => {
    return new Promise<EstimatedFood | null>(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout (12s)"));
      }, 12_000);

      try {
        const est = await provider.estimate(segment);
        clearTimeout(timer);
        if (est.foods.length > 0 && !est.foods[0]!.unresolved) {
          resolve(est.foods[0]!);
        } else {
          resolve(null);
        }
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  };

  try {
    return await singleAttempt();
  } catch {
    // Retry once
    try {
      return await singleAttempt();
    } catch {
      return null;
    }
  }
}

/**
 * Stage 1: Resolve all segments locally (≤ 50ms).
 * Returns immediate resolutions and lists items that need proxy enrichment.
 */
export async function resolveStage1(
  segments: readonly string[],
  saved: readonly SavedFood[],
): Promise<{
  resolutions: SegmentResolution[];
  unknownSegments: { segment: string; index: number }[];
}> {
  const cache = await getAiCache();
  const resolutions: SegmentResolution[] = [];
  const unknownSegments: { segment: string; index: number }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;

    // A. Saved food for bare names
    const usual = matchUsualFood(segment, saved);
    if (usual) {
      resolutions.push({
        segment,
        status: "matched",
        item: savedFoodToDraft(usual),
      });
      continue;
    }

    // B. AI Estimate Cache
    const norm = segment.toLowerCase().trim();
    const cached = cache.get(norm);
    if (cached) {
      resolutions.push({
        segment,
        status: "estimated",
        item: { ...cached },
      });
      continue;
    }

    // C. Exact catalog match from food-db
    const local = resolveSegmentLocally(segment, [...saved]);
    if (!local.unresolved) {
      resolutions.push({
        segment,
        status: "matched",
        item: fromEstimated(local),
      });
      continue;
    }

    // D. Extended ingredient table match
    const parsed = parseLeadingQuantity(segment);
    const def = findFoodDefinition(parsed.name);
    if (def) {
      const amount = parsed.amount !== undefined ? parsed.amount : 1;
      const effectiveUnit = parsed.unit || (def.katoriG ? "katori" : undefined);
      const macros = calculateFoodMacros(def, amount, effectiveUnit, parsed.size);
      const unitLabel = parsed.unit
        ? parsed.unit
        : def.katoriG
          ? "katori"
          : def.pieceG
            ? amount === 1
              ? "piece"
              : "pieces"
            : "serving";
      const formattedQty = `${formatAmount(amount)} ${unitLabel}`.trim();

      resolutions.push({
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

    // E. Typical values
    const typical = localFoodItems(segment);
    if (typical && typical.length > 0) {
      resolutions.push({
        segment,
        status: "estimated",
        item: typical[0],
      });
      continue;
    }

    // F. Unknown segment: skeleton card placeholder
    const cleanName = parsed.name || segment;
    resolutions.push({
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
    unknownSegments.push({ segment, index: i });
  }

  return { resolutions, unknownSegments };
}

/**
 * Return per-segment resolution results for Kitchen and detailed reviews.
 * Runs Stage 1 local match instantly, then proxy enrichment for unknown items.
 */
export async function resolveSegments(
  text: string,
  options?: {
    saved?: readonly SavedFood[];
    eatingOut?: boolean;
    provider?: DescriptionAiProvider | null;
    onUpdate?: (resolutions: SegmentResolution[]) => void;
  },
): Promise<SegmentResolution[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const saved = options?.saved ?? [];
  const rawSegments = splitDescriptionSegments(trimmed);
  const provider =
    options?.provider === undefined
      ? getDescriptionAiProvider()
      : options.provider;

  const { resolutions, unknownSegments } = await resolveStage1(rawSegments, saved);

  // If no proxy or no unknown items, we're done
  if (!provider || unknownSegments.length === 0) {
    return resolutions;
  }

  // Notify initial state if callback provided
  options?.onUpdate?.([...resolutions]);

  // Stage 2: Parallel proxy requests (max 4 concurrent)
  const CONCURRENCY = 4;
  for (let i = 0; i < unknownSegments.length; i += CONCURRENCY) {
    const chunk = unknownSegments.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ segment, index }) => {
        const est = await fetchWithRetry(segment, provider);
        if (est) {
          // Check Food DB precedence: catalog values win on exact match
          const entry = matchFoodEntry(est.name, 3);
          let item: DraftItem;
          if (entry && isSameUnit(est.unit, entry.unit)) {
            const scaled = scalePortionMacros(entry, est.estimatedAmount);
            item = fromEstimated({
              ...est,
              entryId: entry.id,
              calories: scaled.calories,
              protein: scaled.protein,
              carbs: scaled.carbs,
              fat: scaled.fat,
              ...pickMicronutrients(scaled),
              nutritionSource: "food-db",
            });
          } else {
            item = lenientDraftFromEstimate(est);
          }

          if (isPlausibleItem(item)) {
            resolutions[index] = {
              segment,
              status: "estimated",
              item,
            };
            // Cache successful AI estimate
            await setAiCache(segment.toLowerCase().trim(), item);
            options?.onUpdate?.([...resolutions]);
          }
        }
      }),
    );
  }

  return resolutions;
}

/**
 * Staged resolution pipeline:
 * Instant local answer (≤ 50ms) -> parallel proxy calls -> human review items.
 * Never dumps text to a blank form.
 */
export async function resolveStaged(
  text: string,
  options: {
    saved: readonly SavedFood[];
    eatingOut?: boolean;
    provider?: DescriptionAiProvider | null;
  },
  onUpdate?: (items: DraftItem[]) => void,
): Promise<ResolveOutcome> {
  const trimmed = text.trim();
  if (!trimmed) return { status: "empty" };

  const eatingOut = options.eatingOut === true;
  const resolutions = await resolveSegments(text, {
    saved: options.saved,
    eatingOut,
    provider: options.provider,
    onUpdate: (segs) => {
      const liveItems = segs.map((s) => s.item!).filter(Boolean);
      onUpdate?.(finalize(liveItems, eatingOut));
    },
  });

  const finalItems = resolutions.map((s) => s.item!).filter(Boolean);
  if (finalItems.length === 0) {
    return { status: "empty" };
  }

  return {
    status: "ready",
    items: finalize(finalItems, eatingOut),
  };
}

/**
 * Turn a typed sentence ("2 rotis, dal, paneer bhurji") into reviewable items.
 * Backward compatible wrapper over staged resolution: if any item remains
 * unresolved (0 kcal manual source), returns manual fallback for legacy callers/tests,
 * while resolveStaged keeps items as cards for the modern review UI.
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
  const resolutions = await resolveSegments(text, {
    saved: options.saved,
    eatingOut,
    provider: options.provider,
  });

  const finalItems = resolutions.map((s) => s.item!).filter(Boolean);
  if (finalItems.length === 0) {
    return { status: "empty" };
  }

  // If any segment couldn't be resolved (source is manual or status is needs-input with 0 kcal),
  // return legacy manual status so whole-entry manual fallback behaves as expected in older tests/callers.
  const hasUnresolved = resolutions.some(
    (r) => r.status === "needs-input" || (r.item && r.item.source === "manual" && r.item.calories === 0),
  );

  if (hasUnresolved) {
    const provider =
      options.provider === undefined
        ? getDescriptionAiProvider()
        : options.provider;
    return {
      status: "manual",
      name: trimmed,
      reason: provider ? "unreadable" : "unavailable",
    };
  }

  return {
    status: "ready",
    items: finalize(finalItems, eatingOut),
  };
}

