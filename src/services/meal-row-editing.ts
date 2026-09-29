/**
 * The editable review row (`FoodRow`) shown in the meal review sheet:
 * seeding a row from a resolved food, rescaling it when the amount/unit
 * changes, and converting it back to the persisted `MealFood` shape.
 * Everything here is about ONE row in isolation — totals across rows
 * live in meal-nutrition-math.ts.
 */

import type { EstimatedFood } from "@/components/quick-add/meal-sheet";
import {
  getFoodEntry,
  isSameUnit,
  scalePortionMacros,
} from "@/services/food-db";
import type { MacroTotals } from "@/storage/repositories/meals";
import {
  NUTRIENT_KEYS,
  pickMicronutrients,
  type MealFood,
  type Micronutrients,
  type NutritionSource,
} from "@/types/gymos";
import { createId } from "@/utils/id";

/**
 * Editable review row for one detected/resolved food. Every displayed
 * field is text; micros ride along opaquely (no micro inputs exist in
 * the primary row UI). `entryId` links catalog-sourced rows back to the
 * offline food DB so later amount/unit edits can rescale nutrition —
 * absent for manually-resolved foods, which carry no catalog portion to
 * scale from. `unresolved` marks a row whose nutrition still needs manual
 * entry (never silently fabricated). A meal simply contains rows: there
 * is no additionals concept in this shape (legacy ones are folded flat
 * in `mealToEstimate`).
 */
export type FoodRow = {
  key: string;
  name: string;
  amount: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Opaque micro values carried through review. */
  micros: Micronutrients;
  /** Food DB entry id, when the nutrition came from the catalog. */
  entryId?: string;
  /** True when no confident catalog match existed: the row shows
   *  "Nutrition needed" and the user types macros manually before
   *  logging. Never persisted — the typed values are the record. */
  unresolved?: boolean;
  /** Stable scaling reference for non-catalog rows: the portion amount
   *  the row's nutrition currently describes. Quantity edits rescale all
   *  16 nutrients from `baseNutrition` — never from already-scaled
   *  values. Re-derivable after reload (never persisted). */
  baseAmount?: number;
  /** The 16-nutrient snapshot `baseAmount` describes. */
  baseNutrition?: MacroTotals;
  /** Transient provenance for review; not written to persisted MealFood. */
  nutritionSource?: NutritionSource;
};

/** Row numbers feed persistence/scaling only; blank/invalid count as 0. */
function parseRowNumber(value: string): number {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Optional number for persisted breakdown fields; blank/invalid → omit. */
function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** The row's current 16 nutrients as numbers (blank/invalid → 0, the
 *  same rule persistence uses). */
function snapshotRowNutrition(row: FoodRow): MacroTotals {
  const num = (value: string): number => {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    calories: num(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    ...row.micros,
  };
}

/**
 * Establish (or refresh) a row's stable scaling base from its current
 * text fields: the portion amount plus the full 16-nutrient snapshot it
 * describes. Catalog-linked rows are left alone — they always scale
 * from the DB portion instead. Without a positive amount there is
 * nothing to anchor to, so the row is returned unchanged: typed values
 * simply stay until a usable amount exists. Pure.
 */
export function establishRowBase(row: FoodRow): FoodRow {
  if (row.entryId) {
    return row;
  }

  const parsed = Number(row.amount.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return row;
  }

  return {
    ...row,
    baseAmount: parsed,
    baseNutrition: snapshotRowNutrition(row),
  };
}

/** Seed an editable review row from a resolved food. Unresolved foods
 *  seed with blank nutrition and the flag that renders "Nutrition
 *  needed" until the user types macros manually. Non-catalog rows
 *  (manually entered or reopened stored values) seed a stable scaling
 *  base from their own values so later quantity edits rescale locally —
 *  re-derivable after reload, never persisted. */
export function toFoodRow(food: EstimatedFood): FoodRow {
  const row: FoodRow = {
    key: createId(),
    name: food.name,
    amount: String(food.estimatedAmount),
    unit: food.unit,
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    micros: pickMicronutrients(food),
    ...(food.entryId ? { entryId: food.entryId } : {}),
    ...(food.unresolved ? { unresolved: true } : {}),
    ...(food.nutritionSource
      ? { nutritionSource: food.nutritionSource }
      : {}),
  };

  return establishRowBase(row);
}

/** Convert an editable row to the persisted breakdown shape. Returns null
 *  for unnamed rows: totals stay authoritative, but the breakdown only
 *  keeps identifiable foods. All 16 nutrients (macros parsed from the
 *  text fields + opaque micros) travel through. */
export function foodRowToMealFood(row: FoodRow): MealFood | null {
  const name = row.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    ...(row.entryId ? { entryId: row.entryId } : {}),
    amount: parseOptionalNumber(row.amount),
    unit: row.unit.trim() || undefined,
    calories: parseRowNumber(row.calories),
    protein: parseRowNumber(row.protein),
    carbs: parseRowNumber(row.carbs),
    fat: parseRowNumber(row.fat),
    ...row.micros,
  };
}

/**
 * Re-derive a row's nutrition from its current amount and unit — called
 * on every amount/unit edit so meal totals update instantly with no
 * manual recalculation and no network call. Catalog-linked rows scale
 * from the DB portion (Food DB wins, S6A #2); other rows scale all 16
 * nutrients from their stable `baseNutrition` snapshot (manual entries,
 * reopened values) — never from already-scaled values.
 * Rows with neither scale from keep their nutrition as typed, and
 * blank/invalid amounts contribute 0 (same rule the sheet has always
 * used for row numbers).
 */
export function rescaleFoodRow(row: FoodRow): FoodRow {
  const entry = row.entryId
    ? getFoodEntry(row.entryId)
    : undefined;

  if (entry && isSameUnit(row.unit, entry.unit)) {
    const scaled = scalePortionMacros(entry, parseRowNumber(row.amount));

    return {
      ...row,
      calories: String(scaled.calories),
      protein: String(scaled.protein),
      carbs: String(scaled.carbs),
      fat: String(scaled.fat),
      micros: pickMicronutrients(scaled),
    };
  }

  if (
    !entry &&
    row.baseAmount !== undefined &&
    row.baseAmount > 0 &&
    row.baseNutrition
  ) {
    const ratio = parseRowNumber(row.amount) / row.baseAmount;
    const round2 = (value: number) =>
      Math.round(value * 100) / 100;
    const scaled: MacroTotals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    for (const key of NUTRIENT_KEYS) {
      scaled[key] = round2((row.baseNutrition[key] ?? 0) * ratio);
    }

    return {
      ...row,
      calories: String(scaled.calories),
      protein: String(scaled.protein),
      carbs: String(scaled.carbs),
      fat: String(scaled.fat),
      micros: pickMicronutrients(scaled),
    };
  }

  return row;
}

/**
 * True when a busy-guarded text action may start: nothing in flight and
 * non-blank trimmed input. Shared by the Add Food resolve button and the
 * meal review's food resolver so duplicate submissions are blocked
 * identically in both places (S6A #8).
 */
export function canStartAnalysis(
  inFlight: boolean,
  text: string,
): boolean {
  return !inFlight && text.trim() !== "";
}

/**
 * Apply one field patch to a review row, refreshing the stable scaling
 * base when hand-typed macros land on a non-catalog row (so a later
 * quantity edit rescales the entered values instead of freezing them).
 * Catalog rows always scale from the DB portion. Sibling fields are
 * never touched: each macro/micro/amount/unit edit only writes its own
 * key. Pure — shared by the sheet's update paths so the rule is tested
 * once, in one place.
 */
export function applyFoodRowPatch(
  row: FoodRow,
  patch: Partial<FoodRow>,
): FoodRow {
  const next = { ...row, ...patch };

  if (
    !next.entryId &&
    (patch.calories !== undefined ||
      patch.protein !== undefined ||
      patch.carbs !== undefined ||
      patch.fat !== undefined)
  ) {
    return establishRowBase(next);
  }

  return next;
}
