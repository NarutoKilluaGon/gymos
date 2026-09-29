/**
 * Converting between the shapes nutrition moves through: a resolved
 * `MealEstimate`, the save-time `MealInput`, a persisted `Meal`, and a
 * reusable `SavedFood`. Each function here is a one-way or round-trip
 * conversion between two of those shapes — the "boring but load-bearing"
 * glue that keeps saving, reopening, and repeating a meal consistent.
 */

import type {
  EstimatedFood,
  MealInput,
} from "@/components/quick-add/meal-sheet";
import type { MealEstimate } from "@/services/meal-description-ai-provider";
import {
  foldFoodNutrition,
  toCanonicalMealNutrition,
} from "@/services/meal-nutrition-math";
import type { MacroTotals } from "@/storage/repositories/meals";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import { pickMicronutrients, type Meal, type MealFood, type Micronutrients } from "@/types/gymos";

/**
 * Flatten an estimate into the MealSheet's manual-entry shape:
 * meal name = joined food names, meal macros = totals (both editable
 * in the sheet before saving).
 */
export function mealInputFromEstimate(
  estimate: MealEstimate,
): MealInput {
  return {
    name: estimate.foods
      .map((food) => food.name)
      .join(", "),
    calories: estimate.totals.calories,
    protein: estimate.totals.protein,
    carbs: estimate.totals.carbs,
    fat: estimate.totals.fat,
    ...pickMicronutrients(estimate.totals),
    ...(estimate.foods.length > 0
      ? {
          foods: estimate.foods.map(estimatedFoodToMealFood),
        }
      : {}),
  };
}

/**
 * Build the MealInput emitted by the review sheet. Derived food totals
 * are authoritative for keys represented by the current rows, while the
 * original meal-level micronutrients remain a fallback for sparse legacy
 * rows. This keeps a re-save from turning an unknown row into a newly
 * invented zero when the persisted meal already carried a value.
 */
export function mealInputForSave(input: {
  name: string;
  displayedTotals: Pick<
    MealInput,
    "calories" | "protein" | "carbs" | "fat"
  >;
  derivedTotals?: MacroTotals | null;
  foods?: MealFood[];
  fallbackMicronutrients?: Micronutrients;
}): MealInput {
  const foods = input.foods ?? [];
  const derivedMicronutrients = input.derivedTotals
    ? pickMicronutrients(input.derivedTotals)
    : {};
  const fallbackMicronutrients = pickMicronutrients(
    input.fallbackMicronutrients ?? {},
  );

  // Resolve represented-row precedence once here as well as at the
  // persistence boundary. This keeps the helper correct when used by a
  // caller that does not immediately invoke toCanonicalMealNutrition().
  const canonical = toCanonicalMealNutrition({
    ...input.displayedTotals,
    ...derivedMicronutrients,
    ...fallbackMicronutrients,
    foods,
  });

  return {
    name: input.name.trim(),
    ...input.displayedTotals,
    ...pickMicronutrients(canonical),
    ...(foods.length > 0 ? { foods } : {}),
  };
}

/** Repeat a stored meal without dropping its flat micronutrients. */
export function mealInputFromRecentMeal(meal: Meal): MealInput {
  return {
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    ...pickMicronutrients(meal),
    ...(meal.foods && meal.foods.length > 0
      ? { foods: meal.foods }
      : {}),
  };
}

/**
 * Reopen a saved meal in the review/edit flow: convert the persisted
 * breakdown back into an estimate. Meals saved without a breakdown
 * (totals-only) yield zero food rows — their totals still seed the sheet.
 * Legacy additionals are folded flat (see foldFoodNutrition); the
 * catalog id rides along so amount edits can rescale after a reload.
 */
export function mealToEstimate(meal: Meal): MealEstimate {
  const foods: EstimatedFood[] = (meal.foods ?? []).map((food) => ({
    name: food.name,
    estimatedAmount: food.amount ?? 0,
    unit: food.unit ?? "",
    ...foldFoodNutrition(food),
    ...(food.entryId ? { entryId: food.entryId } : {}),
  }));

  return {
    foods,
    totals: {
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      ...pickMicronutrients(meal),
    },
  };
}

/**
 * Rebuild a reusable saved meal (S4) as a reviewable estimate from its
 * STORED values only — no food DB lookup, network, or recalculation.
 * Each food is a fresh object, so editing the logged copy can never
 * mutate the saved template.
 */
export function savedFoodToEstimate(saved: SavedFood): MealEstimate {
  return mealToEstimate({
    id: saved.id,
    name: saved.name,
    timestamp: saved.createdAt,
    calories: saved.calories,
    protein: saved.protein,
    carbs: saved.carbs,
    fat: saved.fat,
    ...(saved.foods ? { foods: saved.foods } : {}),
    ...pickMicronutrients(saved),
  });
}

/**
 * Derive compact recent foods from logged meals for fast repeat
 * logging: individual breakdown foods across the given meals, latest
 * first, deduped by normalized name (the first hit wins, so the most
 * recent logging is the reference). Malformed meals/foods are skipped,
 * never thrown. Pure — the screen memoizes this over today's meals, so
 * no new storage exists.
 */
export function recentFoodsFromMeals(
  meals?: Meal[] | null,
  limit = 6,
): MealFood[] {
  const list = Array.isArray(meals) ? meals : [];
  const ordered = [...list].sort((a, b) => {
    const timeA =
      a && typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : Number.NaN;
    const timeB =
      b && typeof b.timestamp === "string"
        ? new Date(b.timestamp).getTime()
        : Number.NaN;
    const safeA = Number.isFinite(timeA) ? timeA : Number.NEGATIVE_INFINITY;
    const safeB = Number.isFinite(timeB) ? timeB : Number.NEGATIVE_INFINITY;

    return safeB - safeA;
  });

  const seen = new Set<string>();
  const out: MealFood[] = [];

  for (const meal of ordered) {
    const foods =
      meal && Array.isArray(meal.foods) ? meal.foods : [];

    for (const food of foods) {
      const key =
        food && typeof food.name === "string"
          ? food.name.trim().toLowerCase()
          : "";

      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      out.push(food);

      if (out.length >= limit) {
        return out;
      }
    }
  }

  return out;
}

/**
 * Secondary card line for a meal's foods, or null when it merely repeats
 * the title (every food name already appears in it). Keeps diary cards
 * compact without losing information.
 */
export function mealFoodsLine(
  name: string,
  foods?: MealFood[],
): string | null {
  // Defensive: persisted records predate validation (raw import/restore
  // carries any JSON shape), so coerce instead of calling methods on
  // possibly-malformed values. Valid records behave exactly as before.
  const names = (Array.isArray(foods) ? foods : [])
    .map((food) => String(food?.name ?? "").trim())
    .filter((foodName) => foodName.length > 0);

  if (names.length === 0) {
    return null;
  }

  const title = String(name ?? "")
    .trim()
    .toLowerCase();
  const addsInfo = names.some(
    (foodName) => !title.includes(foodName.toLowerCase()),
  );

  return addsInfo ? names.join(" + ") : null;
}

/** Convert an already-resolved estimate row to the persisted shape. */
export function estimatedFoodToMealFood(
  food: EstimatedFood,
): MealFood {
  return {
    name: food.name,
    amount: food.estimatedAmount,
    unit: food.unit,
    ...(food.entryId ? { entryId: food.entryId } : {}),
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    ...pickMicronutrients(food),
  };
}
