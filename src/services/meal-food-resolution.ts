/**
 * Resolving a food name (or a whole description) against what GymOS
 * already knows offline: the Food DB catalog first, the user's own saved
 * foods second, and an explicitly-unresolved manual row otherwise.
 * Nothing here calls a provider or the network — this is the "AI is an
 * assistant, not the foundation" path in code.
 */

import type { EstimatedFood } from "@/types/gymos";
import {
  isSameUnit,
  matchFoodEntry,
  normalizeFoodName,
  scalePortionMacros,
} from "@/services/food-db";
import {
  parseLeadingQuantity,
  splitDescriptionSegments,
} from "@/services/meal-description-parsing";
import { computeMealTotals } from "@/services/meal-nutrition-math";
import type { MealEstimate } from "@/services/meal-description-ai-provider";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import { pickMicronutrients } from "@/types/gymos";

/**
 * Resolve a structured (name, amount, unit) triple against the catalog:
 * exact normalized match incl. everyday aliases, scaled within the
 * catalog's own unit. Returns undefined on no confident match. On a
 * name match with an inconvertible unit, returns undefined by default —
 * or, with `retainEntryOnUnitMismatch`, an explicitly-unresolved row
 * that keeps the catalog link so the review can offer the entry's unit
 * (macros stay zero/"unknown"; nothing is scaled across units).
 * The single choke point every local resolution scales through, so Food
 * DB precedence is identical everywhere.
 */
function resolveFoodByName(
  name: string,
  amount: number | undefined,
  unit: string,
  opts?: { retainEntryOnUnitMismatch?: boolean },
): EstimatedFood | undefined {
  if (!name) {
    return undefined;
  }

  const entry = matchFoodEntry(name, 3);

  if (!entry) {
    return undefined;
  }

  const finalAmount =
    amount !== undefined && Number.isFinite(amount) && amount > 0
      ? amount
      : entry.amount;

  // A stated unit other than the catalog's would need a conversion this
  // app does not do.
  if (unit !== "" && !isSameUnit(unit, entry.unit)) {
    if (!opts?.retainEntryOnUnitMismatch) {
      return undefined;
    }

    return {
      name: entry.name,
      estimatedAmount: finalAmount,
      unit,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      entryId: entry.id,
      unresolved: true,
      nutritionSource: "food-db",
    };
  }

  const scaled = scalePortionMacros(entry, finalAmount);

  return {
    name: entry.name,
    estimatedAmount: finalAmount,
    unit: entry.unit,
    entryId: entry.id,
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    ...pickMicronutrients(scaled),
    nutritionSource: "food-db",
  };
}

/**
 * Offline catalog resolution: an EXACT normalized-name match only
 * (matchFoodEntry minScore 3, incl. everyday aliases like yogurt→curd).
 * Anything less reliable — a bare "rice", or a "homemade paneer curry"
 * that merely contains a catalog name — resolves to nothing so a
 * user-stated food is never silently swapped for a near-name. Nutrition
 * scales within the catalog's own unit; a stated unit we cannot convert
 * also resolves to nothing. Explicit amount/unit fields win over
 * quantities parsed from the text; with neither, the entry's own portion
 * is used.
 */
function resolveFromFoodDb(
  raw: string,
  explicit?: { amount?: number; unit?: string },
): EstimatedFood | undefined {
  const parsed = parseLeadingQuantity(raw);

  if (!parsed.name) {
    return undefined;
  }

  const explicitAmount =
    explicit?.amount !== undefined &&
    Number.isFinite(explicit.amount) &&
    explicit.amount > 0
      ? explicit.amount
      : undefined;

  return resolveFoodByName(
    parsed.name,
    explicitAmount ?? parsed.amount,
    explicit?.unit?.trim() || parsed.unit || "",
    { retainEntryOnUnitMismatch: true },
  );
}

/**
 * Match a parsed food name against the user's own saved foods
 * (resolution priority #2, after the Food DB): exact normalized-name
 * equality over individual saved foods only. Saved MEALS stay
 * explicit-UI-only, and entries without stored calories can't serve as
 * a source. The user's own numbers need no network and no guessing.
 */
export function matchSavedFood(
  name: string,
  savedFoods?: SavedFood[] | null,
): SavedFood | undefined {
  const list = Array.isArray(savedFoods) ? savedFoods : [];
  const q = normalizeFoodName(name);

  if (!q) {
    return undefined;
  }

  return list.find(
    (saved) =>
      !!saved &&
      typeof saved.name === "string" &&
      normalizeFoodName(saved.name) === q &&
      !(saved.foods && saved.foods.length > 0) &&
      typeof saved.calories === "number" &&
      Number.isFinite(saved.calories),
  );
}

/**
 * Resolve a structured (name, amount, unit) triple from a saved-food
 * match: the user's stored macros/micros apply as-is (no catalog
 * portion exists to scale from — the parsed quantity labels the row).
 * No `entryId` (nothing to rescale from) and no `unresolved` flag: the
 * user's own stored numbers ARE the record, and `toFoodRow` seeds a
 * scaling base from them automatically.
 */
function resolveFromSavedFood(
  name: string,
  amount: number | undefined,
  unit: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood | undefined {
  const saved = matchSavedFood(name, savedFoods);

  if (!saved) {
    return undefined;
  }

  const num = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    name: saved.name,
    estimatedAmount:
      amount !== undefined && Number.isFinite(amount) && amount > 0
        ? amount
        : 1,
    unit,
    calories: num(saved.calories),
    protein: num(saved.protein),
    carbs: num(saved.carbs),
    fat: num(saved.fat),
    ...pickMicronutrients(saved),
    nutritionSource: "manual",
  };
}

/**
 * Build an explicitly-unresolved food: parsed name/amount/unit travel
 * through, every macro is zero, no micros are claimed, no catalog link
 * is recorded. The review sheet renders "Nutrition needed" for these —
 * zero here means "unknown", never a real measurement.
 */
function unresolvedFood(raw: string): EstimatedFood {
  const text = raw.trim();
  const parsed = parseLeadingQuantity(text);
  const name = parsed.name || text;

  return {
    name,
    estimatedAmount: parsed.amount ?? 1,
    unit: parsed.unit ?? "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    unresolved: true,
    nutritionSource: "manual",
  };
}

/**
 * Resolve one food segment locally: exact catalog match with scaled
 * 16-nutrient nutrition, then the user's own saved foods, otherwise an
 * explicitly-unresolved row for manual entry. Pure, synchronous,
 * offline — no network, no provider, no fabrication.
 */
export function resolveSegmentLocally(
  segment: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood {
  const text = segment.trim();

  if (!text) {
    return unresolvedFood(text);
  }

  const parsed = parseLeadingQuantity(text);
  const amount = parsed.amount;
  const unit = parsed.unit ?? "";

  return (
    resolveFromFoodDb(text) ??
    (parsed.name
      ? resolveFromSavedFood(parsed.name, amount, unit, savedFoods)
      : undefined) ??
    unresolvedFood(text)
  );
}

/**
 * Resolve a whole description locally: split into segments, resolve
 * each against the Food DB then saved foods. Every distinct food becomes
 * its own row — resolved rows carry catalog/user nutrition, the rest
 * carry `unresolved: true` for manual entry. Blank input yields no rows.
 */
export function resolveMealDescription(
  description: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood[] {
  const text = description.trim();

  if (!text) {
    return [];
  }

  return splitDescriptionSegments(text).map((segment) =>
    resolveSegmentLocally(segment, savedFoods),
  );
}

export type FoodLookup = {
  /** Food name/description exactly as typed. */
  description: string;
  /** Explicit amount field, when the user filled it in. */
  amount?: number;
  /** Explicit unit field, when the user filled it in. */
  unit?: string;
};

export type FoodResolveResult =
  | { status: "resolved"; foods: EstimatedFood[] }
  /** No confident catalog match: rows carry `unresolved: true` and zero
   *  macros so the review sheet shows "Nutrition needed" instead of
   *  fabricated values. Nothing is guessed, substituted, or fetched. */
  | { status: "unresolved"; foods: EstimatedFood[] }
  /** Nothing usable: blank input. */
  | { status: "none" };

/**
 * Resolve one "+ Add food" entry locally: exact Food DB match, then the
 * user's saved foods, otherwise a single explicitly-unresolved row for
 * manual entry. Synchronous and offline — no provider, no network, no
 * pending queue, no fabricated nutrition.
 */
export function resolveFoodForMeal(
  input: FoodLookup,
  savedFoods?: SavedFood[] | null,
): FoodResolveResult {
  const raw = input.description.trim();

  if (!raw) {
    return { status: "none" };
  }

  const amount =
    input.amount !== undefined &&
    Number.isFinite(input.amount) &&
    input.amount > 0
      ? input.amount
      : undefined;
  const unit = input.unit?.trim() || undefined;

  const local = resolveFromFoodDb(raw, { amount, unit });

  if (local) {
    // A name match with an inconvertible unit still arrives unresolved
    // (zero macros + catalog link for the "Use {unit}" hint) — never as
    // a resolved row.
    return local.unresolved === true
      ? { status: "unresolved", foods: [local] }
      : { status: "resolved", foods: [local] };
  }

  const parsed = parseLeadingQuantity(raw);

  if (parsed.name) {
    const saved = resolveFromSavedFood(
      parsed.name,
      amount ?? parsed.amount,
      unit ?? parsed.unit ?? "",
      savedFoods,
    );

    if (saved) {
      return { status: "resolved", foods: [saved] };
    }
  }

  return { status: "unresolved", foods: [unresolvedFood(raw)] };
}

/**
 * Apply the local Food DB precedence rule to an AI estimate.
 *
 * The AI owns food identity and parsing. For each returned food we may
 * replace only its nutrition with a reliable, unit-compatible catalog
 * value scaled to the stated amount. The user-facing name and unit stay
 * exactly as the AI returned them. Unknown foods retain their AI values;
 * they are never replaced with a guessed local food.
 */
export function applyFoodDbPrecedence(
  estimate: MealEstimate,
): MealEstimate {
  const foods = estimate.foods.map((food) => {
    const entry = matchFoodEntry(food.name, 3);

    if (!entry || !isSameUnit(food.unit, entry.unit)) {
      return {
        ...food,
        nutritionSource: "ai" as const,
      };
    }

    const scaled = scalePortionMacros(entry, food.estimatedAmount);

    return {
      ...food,
      entryId: entry.id,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      ...pickMicronutrients(scaled),
      nutritionSource: "food-db" as const,
    };
  });

  return {
    foods,
    totals: computeMealTotals(foods),
  };
}
