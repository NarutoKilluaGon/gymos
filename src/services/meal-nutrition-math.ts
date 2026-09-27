/**
 * Pure nutrition arithmetic shared across the estimator: summing a food
 * breakdown into totals, and reconciling a meal's flat nutrition fields
 * with its per-food breakdown into one canonical shape. Nothing here
 * touches storage, the network, or a provider — every function is a
 * plain, synchronous, testable transform.
 */

import type { MacroTotals } from "@/storage/repositories/meals";
import {
  MACRO_KEYS,
  MICRONUTRIENT_KEYS,
  NUTRIENT_KEYS,
  pickMicronutrients,
  type Micronutrients,
  type MealFood,
} from "@/types/gymos";

/**
 * Fold one stored food (plus its LEGACY additionals, if any) into a flat
 * set of nutrients. S6A removed the additionals concept from the meal
 * editor: reopening an old meal folds their nutrition into the parent
 * food, so every stored nutrient survives while the nested list does not
 * reappear. Key presence mirrors the inputs — micros only appear when
 * defined somewhere, keeping sparse legacy records sparse.
 */
export function foldFoodNutrition(food: MealFood): MacroTotals {
  const items = [food, ...(food.additionals ?? [])];
  const out: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const sum = (key: (typeof NUTRIENT_KEYS)[number]) =>
    round2(
      items.reduce(
        (total, item) => total + (item[key] ?? 0),
        0,
      ),
    );

  for (const key of MACRO_KEYS) {
    out[key] = sum(key);
  }

  for (const key of MICRONUTRIENT_KEYS) {
    const defined = items.some(
      (item) => typeof item[key] === "number",
    );

    if (defined) {
      out[key] = sum(key);
    }
  }

  return out;
}

/**
 * Sum meal-level totals from a per-food breakdown. Pure and shared: the
 * review sheet derives its displayed totals from this one implementation
 * on every edit (S6A — there is no manual recalc), and tests assert
 * against it too. Each food's LEGACY additionals still count, so stored
 * records never lose nutrition even though nothing creates them anymore.
 */
export function computeMealTotals(
  foods: MealFood[],
): MacroTotals {
  const totals: MacroTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  for (const food of foods) {
    // Each food plus its additionals, across the canonical nutrient list
    // (macros + micros; absent reads as untracked zero).
    const items = [food, ...(food.additionals ?? [])];

    for (const item of items) {
      for (const key of NUTRIENT_KEYS) {
        totals[key] = (totals[key] ?? 0) + (item[key] ?? 0);
      }
    }
  }

  const round2 = (value: number) =>
    Math.round(value * 100) / 100;

  for (const key of NUTRIENT_KEYS) {
    totals[key] = round2(totals[key] ?? 0);
  }

  return totals;
}

export type CanonicalMealNutritionInput = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
} & Micronutrients & {
  /** Optional per-food breakdown. When present, macros come from it. */
  foods?: MealFood[];
};

function finiteNutritionNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

/**
 * Convert every meal entry point to the one persistence nutrition shape.
 * A supplied food breakdown is authoritative for macros and for any
 * micronutrient represented by at least one food. If a legacy breakdown
 * has no micronutrient values, a flat meal-level value is retained rather
 * than silently overwritten with zero.
 */
export function toCanonicalMealNutrition(
  input: CanonicalMealNutritionInput,
): MacroTotals {
  const flat: MacroTotals = {
    calories: finiteNutritionNumber(input.calories),
    protein: finiteNutritionNumber(input.protein),
    carbs: finiteNutritionNumber(input.carbs),
    fat: finiteNutritionNumber(input.fat),
    ...pickMicronutrients(input),
  };
  const foods = Array.isArray(input.foods)
    ? input.foods
    : [];

  if (foods.length === 0) {
    return flat;
  }

  const canonical = computeMealTotals(foods);

  for (const key of MICRONUTRIENT_KEYS) {
    const representedInFoods = foods.some((food) => {
      const items = [food, ...(food.additionals ?? [])];
      return items.some(
        (item) =>
          typeof item[key] === "number" &&
          Number.isFinite(item[key]),
      );
    });

    if (!representedInFoods) {
      const value = input[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        canonical[key] = value;
      }
    }
  }

  return canonical;
}

/** True when a reusable record contains at least one nutrition value. */
export function hasCanonicalNutrition(
  input: CanonicalMealNutritionInput,
): boolean {
  const nutrition = toCanonicalMealNutrition(input);
  return NUTRIENT_KEYS.some(
    (key) => (nutrition[key] ?? 0) > 0,
  );
}

/** Reuse requires both completed rows and a non-empty nutrition snapshot. */
export function canSaveReusableNutrition(
  input: CanonicalMealNutritionInput,
  hasUnresolvedFood = false,
): boolean {
  return !hasUnresolvedFood && hasCanonicalNutrition(input);
}
