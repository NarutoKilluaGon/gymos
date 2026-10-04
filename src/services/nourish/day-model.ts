import { WORKOUT_CARDIO_KCAL_PER_MIN } from "@/services/nourish/cardio";
import { groupMealsByDay } from "@/services/nourish/insights";
import {
  dayBudget,
  macroTargets,
  totalsFor,
  type DayTotals,
} from "@/services/nourish/nutrition";
import { slotOfMeal } from "@/services/nourish/slots";
import type { TimelineItem } from "@/types/timeline";
import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";
import type {
  CardioMap,
  DayFeel,
  FeelMap,
  NourishSettings,
} from "@/types/nourish";
import { dateKeyFromTimestamp } from "@/utils/date";

/** One line of calories burned for a day. */
export type BurnEntry = {
  id: string;
  name: string;
  detail: string;
  kcal: number;
  source: "nourish" | "workouts";
  /** Only cardio logged in Nourish can be removed here. */
  removable: boolean;
};

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** Cardio logged in the Workouts module, per local day. Uses the calories
 *  the user entered, else ~8 kcal/min, and says which in the detail. */
export function workoutCardioByDay(
  items: readonly TimelineItem[],
): Record<string, BurnEntry[]> {
  const byDay: Record<string, BurnEntry[]> = {};

  for (const item of items) {
    if (item.kind !== "cardio") continue;

    const key = dateKeyFromTimestamp(item.timestamp);

    if (!key) continue;

    const entered =
      typeof item.calories === "number" &&
      Number.isFinite(item.calories) &&
      item.calories > 0;
    const kcal = entered
      ? (item.calories ?? 0)
      : Math.round(Number(item.durationMin) * WORKOUT_CARDIO_KCAL_PER_MIN);

    // A malformed record must never put NaN into the day's budget.
    if (!Number.isFinite(kcal)) continue;
    const detail = [
      `${Math.round(item.durationMin)} min`,
      item.distanceKm !== undefined ? `${item.distanceKm} km` : null,
      entered ? null : "estimated",
    ]
      .filter(Boolean)
      .join(" · ");

    (byDay[key] ??= []).push({
      id: item.id,
      name: capitalize(item.activity),
      detail,
      kcal,
      source: "workouts",
      removable: false,
    });
  }

  return byDay;
}

export type DayModel = {
  key: string;
  meals: Meal[];
  bySlot: Record<MealSlot, Meal[]>;
  totals: DayTotals;
  feel: DayFeel;
  burn: BurnEntry[];
  burnKcal: number;
  budget: number;
  targets: { protein: number; carbs: number; fat: number };
  /** Budget minus calories eaten (negative when over). */
  remaining: number;
  /** Protein still to eat to hit the target (0 when reached). */
  proteinGap: number;
};

export function burnByDay(
  cardio: CardioMap,
  workouts: Readonly<Record<string, BurnEntry[]>>,
): Record<string, number> {
  const out: Record<string, number> = {};

  for (const [key, logs] of Object.entries(cardio)) {
    out[key] = (out[key] ?? 0) + logs.reduce((sum, l) => sum + l.kcal, 0);
  }

  for (const [key, entries] of Object.entries(workouts)) {
    out[key] = (out[key] ?? 0) + entries.reduce((sum, e) => sum + e.kcal, 0);
  }

  return out;
}

export function buildDayModel(input: {
  key: string;
  meals: readonly Meal[];
  feel: FeelMap;
  cardio: CardioMap;
  workoutCardio: Readonly<Record<string, BurnEntry[]>>;
  settings: NourishSettings;
}): DayModel {
  const meals = [...(groupMealsByDay(input.meals).get(input.key) ?? [])].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp),
  );
  const bySlot = Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, [] as Meal[]]),
  ) as Record<MealSlot, Meal[]>;

  for (const meal of meals) bySlot[slotOfMeal(meal)].push(meal);

  const burn: BurnEntry[] = [
    ...(input.cardio[input.key] ?? []).map((log) => ({
      id: log.id,
      name: log.name,
      detail: log.detail,
      kcal: log.kcal,
      source: "nourish" as const,
      removable: true,
    })),
    ...(input.workoutCardio[input.key] ?? []),
  ];
  const burnKcal = burn.reduce((sum, entry) => sum + entry.kcal, 0);
  const totals = totalsFor(meals);
  const budget = dayBudget(input.settings, burnKcal);

  return {
    key: input.key,
    meals,
    bySlot,
    totals,
    feel: input.feel[input.key] ?? {},
    burn,
    burnKcal,
    budget,
    targets: macroTargets(budget, input.settings),
    remaining: budget - totals.calories,
    proteinGap: Math.max(0, input.settings.protein - totals.protein),
  };
}
