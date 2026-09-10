import { appendEvent } from "@/storage/events";
import {
  getAllDailyActivities,
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import type { Meal } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const EMPTY_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export async function addMeal(
  name: string,
  macros?: Partial<
    Pick<
      Meal,
      "calories" | "protein" | "carbs" | "fat"
    >
  >,
): Promise<Meal> {
  const activity = await getDailyActivity(getTodayKey());

  const meal: Meal = {
    id: createId(),
    name,
    timestamp: new Date().toISOString(),
    ...macros,
  };

  if (!Array.isArray(activity.meals)) {
    activity.meals = [];
  }

  activity.meals.push(meal);

  await saveDailyActivity(activity);

  await appendEvent("meal.logged", {
    mealId: meal.id,
    name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  });

  return meal;
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
  const activity = await getDailyActivity(todayKey);

  activity.meals = activity.meals.filter(
    (m) => m.id !== mealId,
  );

  await saveDailyActivity(activity);
}

export async function getDailyMacroTotals(
  dateKey: string,
): Promise<MacroTotals> {
  const meals = await getMealsForDate(dateKey);

  if (meals.length === 0) {
    return EMPTY_MACROS;
  }

  return meals.reduce<MacroTotals>(
    (totals, meal) => ({
      calories:
        totals.calories + (meal.calories ?? 0),
      protein:
        totals.protein + (meal.protein ?? 0),
      carbs: totals.carbs + (meal.carbs ?? 0),
      fat: totals.fat + (meal.fat ?? 0),
    }),
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