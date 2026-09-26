import { appendEvent } from "@/storage/events";
import {
  getAllDailyActivities,
  getDailyActivity,
  readDailyActivityUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import type { Meal, MealFood, Micronutrients } from "@/types/gymos";
import { NUTRIENT_KEYS } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} & Micronutrients;

const EMPTY_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export async function addMeal(
  name: string,
  macros?: Partial<MacroTotals>,
  foods?: MealFood[],
): Promise<Meal> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    const meal: Meal = {
      id: createId(),
      name,
      timestamp: new Date().toISOString(),
      ...macros,
      // Optional per-food breakdown (incl. additionals) rides in the same
      // record under the same lock — no second storage key, no second
      // source of truth. Omitted when empty so old totals-only meals and
      // new ones share one shape.
      ...(foods && foods.length > 0 ? { foods } : {}),
    };

    if (!Array.isArray(activity.meals)) {
      activity.meals = [];
    }

    activity.meals.push(meal);

    await writeDailyActivityUnlocked(activity);

    return meal;
  });

  await appendEvent("meal.logged", {
    mealId: saved.id,
    name,
    calories: saved.calories,
    protein: saved.protein,
    carbs: saved.carbs,
    fat: saved.fat,
  });

  return saved;
}

/**
 * Update today's meal in place (edit flow). Same record, same lock, same
 * event-log semantics as addMeal — no new storage, no duplicate entry.
 * Totals stay authoritative; an empty foods list clears a previously
 * saved breakdown. Returns null when the meal is not found (e.g. it was
 * logged on another day, which this diary never edits).
 */
export async function updateMeal(
  id: string,
  name: string,
  macros?: Partial<MacroTotals>,
  foods?: MealFood[],
): Promise<Meal | null> {
  return withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    if (!Array.isArray(activity.meals)) {
      return null;
    }

    const index = activity.meals.findIndex(
      (meal) => meal.id === id,
    );

    if (index === -1) {
      return null;
    }

    const updated: Meal = {
      ...activity.meals[index],
      name,
      ...macros,
      ...(foods && foods.length > 0 ? { foods } : { foods: undefined }),
    };

    activity.meals[index] = updated;

    await writeDailyActivityUnlocked(activity);

    return updated;
  });
}

export async function getMealsForDate(
  dateKey: string,
): Promise<Meal[]> {
  const activity = await getDailyActivity(dateKey);

  return Array.isArray(activity.meals)
    ? activity.meals
    : [];
}

export async function getTodayMeals(): Promise<Meal[]> {
  return getMealsForDate(getTodayKey());
}

export async function deleteMeal(
  mealId: string,
): Promise<void> {
  const todayKey = getTodayKey();

  const deleted = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      todayKey,
    );

    const countBefore = activity.meals.length;

    activity.meals = activity.meals.filter(
      (m) => m.id !== mealId,
    );

    await writeDailyActivityUnlocked(activity);

    return activity.meals.length !== countBefore;
  });

  if (deleted) {
    await appendEvent("meal.deleted", { mealId });
  }
}

export async function getDailyMacroTotals(
  dateKey: string,
): Promise<MacroTotals> {
  const meals = await getMealsForDate(dateKey);

  if (meals.length === 0) {
    return EMPTY_MACROS;
  }

  return meals.reduce<MacroTotals>(
    (totals, meal) => {
      const next = { ...totals };

      for (const key of NUTRIENT_KEYS) {
        next[key] = (next[key] ?? 0) + (meal[key] ?? 0);
      }

      return next;
    },
    EMPTY_MACROS,
  );
}

export async function getAllMeals(): Promise<Meal[]> {
  const data = await getAllDailyActivities();

  return Object.values(data)
    .flatMap((activity) =>
      Array.isArray(activity.meals)
        ? activity.meals
        : [],
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );
}