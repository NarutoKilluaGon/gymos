import { DEFAULT_SLOT_TIME, slotOfMeal, timeOfDay } from "@/services/nourish/slots";
import type { Meal, MealSlot } from "@/types/gymos";

export const OCCASION_GAP_MINUTES = 45;

export type EatingOccasion = {
  id: string;
  meals: Meal[];
  startTime: string; // "HH:MM" or ""
  slot: MealSlot;
  title: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

function getMealTimeMs(meal: Meal): number {
  const d = new Date(meal.timestamp);
  if (!Number.isNaN(d.getTime())) {
    return d.getTime();
  }
  const slot = slotOfMeal(meal);
  const def = DEFAULT_SLOT_TIME[slot] ?? "12:00";
  const [h, m] = def.split(":").map(Number);
  const fallback = new Date(0);
  fallback.setHours(h ?? 12, m ?? 0, 0, 0);
  return fallback.getTime();
}

/**
 * Pure function: Groups a list of meals into eating occasions.
 * - Meals are sorted chronologically by timestamp ascending.
 * - Meals eaten within 45 minutes of the previous meal merge into the same occasion.
 * - Labeled by the first meal's clock time + slot name (e.g., "13:30 · Lunch").
 * - Returns an empty array if there are no meals (never renders empty placeholders).
 */
export function groupIntoOccasions(
  meals: readonly Meal[],
  customTitles?: Record<string, string>,
): EatingOccasion[] {
  if (!meals || meals.length === 0) return [];

  // Sort ascending by timestamp
  const sorted = [...meals].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const occasions: EatingOccasion[] = [];
  let currentMeals: Meal[] = [];
  let lastTimeMs: number | null = null;

  for (const meal of sorted) {
    const mealTimeMs = getMealTimeMs(meal);

    if (currentMeals.length === 0) {
      currentMeals.push(meal);
      lastTimeMs = mealTimeMs;
      continue;
    }

    // Check gap in minutes against previous meal in current occasion
    const gapMinutes =
      lastTimeMs !== null ? Math.abs(mealTimeMs - lastTimeMs) / 60000 : null;

    if (gapMinutes !== null && gapMinutes <= OCCASION_GAP_MINUTES) {
      currentMeals.push(meal);
      lastTimeMs = mealTimeMs;
    } else {
      // Finalize previous occasion
      occasions.push(buildOccasion(currentMeals, customTitles));
      currentMeals = [meal];
      lastTimeMs = mealTimeMs;
    }
  }

  if (currentMeals.length > 0) {
    occasions.push(buildOccasion(currentMeals, customTitles));
  }

  return occasions;
}

function buildOccasion(
  meals: Meal[],
  customTitles?: Record<string, string>,
): EatingOccasion {
  const firstMeal = meals[0];
  const slot = slotOfMeal(firstMeal);
  const time = timeOfDay(firstMeal.timestamp) ?? DEFAULT_SLOT_TIME[slot] ?? "";
  const id = `occasion-${firstMeal.id}`;
  const defaultTitle = time ? `${time} · ${slot}` : slot;
  const title = customTitles?.[id] || defaultTitle;

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    id,
    meals,
    startTime: time,
    slot,
    title,
    totals,
  };
}
