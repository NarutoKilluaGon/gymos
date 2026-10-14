import { DEFAULT_SLOT_TIME, slotOfMeal, timeOfDay } from "@/services/nourish/slots";
import type { Meal, MealSlot } from "@/types/gymos";
import type { FeelValue } from "@/types/nourish";

export const OCCASION_GAP_MINUTES = 45;

export type EatingOccasion = {
  id: string;
  meals: Meal[];
  startTime: string; // "HH:MM" or ""
  slot: MealSlot;
  title: string;
  feel?: FeelValue;
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
  dayFeel?: Record<string, FeelValue>,
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
      occasions.push(buildOccasion(currentMeals, customTitles, dayFeel));
      currentMeals = [meal];
      lastTimeMs = mealTimeMs;
    }
  }

  if (currentMeals.length > 0) {
    occasions.push(buildOccasion(currentMeals, customTitles, dayFeel));
  }

  return occasions;
}

function buildOccasion(
  meals: Meal[],
  customTitles?: Record<string, string>,
  dayFeel?: Record<string, FeelValue>,
): EatingOccasion {
  const firstMeal = meals[0];
  const slot = slotOfMeal(firstMeal);
  const time = timeOfDay(firstMeal.timestamp) ?? DEFAULT_SLOT_TIME[slot] ?? "";
  const defaultTitle = time ? `${time} · ${slot}` : slot;

  // Stable key resolution:
  // If any meal in this occasion already has a custom title, keep that stable occasion key.
  let matchedKey: string | undefined;
  let customTitle: string | undefined;

  for (const m of meals) {
    const candidate = `occasion-${m.id}`;
    if (customTitles?.[candidate] || customTitles?.[m.id]) {
      customTitle = customTitles?.[candidate] ?? customTitles?.[m.id];
      matchedKey = candidate;
      break;
    }
  }

  // Also check if any meal already has a feel key if no title matched
  if (!matchedKey && dayFeel) {
    for (const m of meals) {
      const candidate = `occasion-${m.id}`;
      if (dayFeel[candidate] !== undefined || dayFeel[m.id] !== undefined) {
        matchedKey = candidate;
        break;
      }
    }
  }

  const id = matchedKey ?? `occasion-${firstMeal.id}`;
  const title = customTitle || defaultTitle;

  // Feel resolution:
  // 1. Check matched occasion id (or raw id)
  let feel: FeelValue | undefined =
    dayFeel?.[id] ?? dayFeel?.[id.replace("occasion-", "")];

  // 2. Check each meal's key in the cluster
  if (feel === undefined && dayFeel) {
    for (const m of meals) {
      const candidate = `occasion-${m.id}`;
      if (dayFeel[candidate] !== undefined) {
        feel = dayFeel[candidate];
        break;
      }
      if (dayFeel[m.id] !== undefined) {
        feel = dayFeel[m.id];
        break;
      }
    }
  }

  // 3. Legacy slot fallback
  if (feel === undefined && dayFeel?.[slot] !== undefined) {
    feel = dayFeel[slot];
  }

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
    feel,
    totals,
  };
}
