/**
 * V1: curated list of common meals with estimated macros. The user taps
 * one → it pre-fills the MealSheet (detected foods + totals) → they can
 * edit before saving. No manual macro entry needed for the most common
 * foods, and no dependency on the Food DB or an AI provider.
 */

import type {
  EstimatedFood,
  MealInput,
} from "@/components/quick-add/meal-sheet";
import type { MealEstimate } from "@/services/meal-description-ai-provider";
import { pickMicronutrients } from "@/types/gymos";

/** Curated common meals with estimated macros, searchable by name. */
export const QUICK_MEALS: MealInput[] = [
  { name: "Chicken breast (150g)", calories: 250, protein: 46, carbs: 0, fat: 5 },
  { name: "Grilled salmon (150g)", calories: 280, protein: 31, carbs: 0, fat: 17 },
  { name: "Ground beef (150g)", calories: 330, protein: 27, carbs: 0, fat: 24 },
  { name: "Eggs (2 scrambled)", calories: 180, protein: 12, carbs: 1, fat: 14 },
  { name: "Oatmeal (dry 40g)", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { name: "Rice (cooked 150g)", calories: 206, protein: 4, carbs: 45, fat: 0 },
  { name: "Sweet potato (150g)", calories: 129, protein: 2, carbs: 30, fat: 0 },
  { name: "Protein shake", calories: 160, protein: 27, carbs: 5, fat: 3 },
  { name: "Greek yogurt (200g)", calories: 140, protein: 20, carbs: 7, fat: 3 },
  { name: "Mixed salad bowl", calories: 220, protein: 10, carbs: 18, fat: 12 },
  { name: "Turkey sandwich", calories: 320, protein: 24, carbs: 35, fat: 10 },
  { name: "Peanut butter on toast", calories: 350, protein: 12, carbs: 30, fat: 18 },
  { name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Chicken burrito bowl", calories: 520, protein: 40, carbs: 55, fat: 16 },
  { name: "Pasta with tomato sauce", calories: 380, protein: 12, carbs: 65, fat: 8 },
];

/** Wrap one meal as a single-food estimate (quick-pick catalog). */
function singleFoodEstimate(meal: MealInput): MealEstimate {
  const food: EstimatedFood = {
    name: meal.name,
    estimatedAmount: 1,
    unit: "serving",
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    ...pickMicronutrients(meal),
  };

  return {
    foods: [food],
    totals: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      ...pickMicronutrients(food),
    },
  };
}

export function searchQuickMeals(query: string): MealEstimate[] {
  const q = query.trim().toLowerCase();

  const matches = q
    ? QUICK_MEALS.filter((meal) =>
        meal.name.toLowerCase().includes(q),
      )
    : QUICK_MEALS;

  return matches.map(singleFoodEstimate);
}
