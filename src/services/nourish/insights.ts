import {
  confidenceOf,
  dayBudget,
  totalsFor,
  type DayTotals,
} from "@/services/nourish/nutrition";
import { slotOfMeal } from "@/services/nourish/slots";
import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";
import type { DayFeel, FeelMap, NourishSettings } from "@/types/nourish";
import {
  addDaysToKey,
  dateFromKey,
  dateKeyFromTimestamp,
  daysBetweenKeys,
} from "@/utils/date";

export type DayRecord = {
  key: string;
  meals: Meal[];
  feel: DayFeel;
  cardioKcal: number;
};

export type DayView = {
  key: string;
  record: DayRecord | null;
  /** Null when nothing was logged that day. */
  totals: DayTotals | null;
  budget: number;
};

export function groupMealsByDay(
  meals: readonly Meal[],
): Map<string, Meal[]> {
  const byDay = new Map<string, Meal[]>();

  for (const meal of meals) {
    const key = dateKeyFromTimestamp(meal.timestamp);

    if (!key) continue;

    const list = byDay.get(key);

    if (list) list.push(meal);
    else byDay.set(key, [meal]);
  }

  return byDay;
}

export function buildRecords(
  meals: readonly Meal[],
  feel: FeelMap,
  cardioKcalByDay: Readonly<Record<string, number>>,
): Map<string, DayRecord> {
  const records = new Map<string, DayRecord>();

  for (const [key, list] of groupMealsByDay(meals)) {
    records.set(key, {
      key,
      meals: list,
      feel: feel[key] ?? {},
      cardioKcal: cardioKcalByDay[key] ?? 0,
    });
  }

  return records;
}

/** The last `count` days ending at `todayKey`, oldest first. */
export function recentDays(
  count: number,
  todayKey: string,
  records: ReadonlyMap<string, DayRecord>,
  settings: Pick<NourishSettings, "kcal" | "cardioReturn">,
): DayView[] {
  const days: DayView[] = [];

  for (let back = count - 1; back >= 0; back--) {
    const key = addDaysToKey(todayKey, -back);
    const record = records.get(key) ?? null;
    const logged = record !== null && record.meals.length > 0;

    days.push({
      key,
      record,
      totals: logged && record ? totalsFor(record.meals) : null,
      budget: dayBudget(settings, record?.cardioKcal ?? 0),
    });
  }

  return days;
}

/** Days from the first logged day through today, inclusive (0 if none). */
export function loggedSpanDays(
  records: ReadonlyMap<string, DayRecord>,
  todayKey: string,
): number {
  const logged = [...records.values()]
    .filter((record) => record.meals.length > 0)
    .map((record) => record.key)
    .sort();
  const first = logged[0];

  return first ? Math.max(1, daysBetweenKeys(first, todayKey) + 1) : 0;
}

export type RangeId = "7" | "30" | "90" | "365" | "all";

export type RangeOption = {
  id: RangeId;
  label: string;
  /** Days covered; 0 means "all logged history". */
  days: number;
  /** The range is offered only once history is longer than this. */
  minSpan: number;
};

export const RANGES: readonly RangeOption[] = [
  { id: "7", label: "7D", days: 7, minSpan: -1 },
  { id: "30", label: "30D", days: 30, minSpan: 7 },
  { id: "90", label: "90D", days: 90, minSpan: 30 },
  { id: "365", label: "1Y", days: 365, minSpan: 90 },
  { id: "all", label: "All", days: 0, minSpan: 14 },
];

export function availableRanges(span: number): RangeOption[] {
  return RANGES.filter((range) => span > range.minSpan);
}

/** How many days a range actually shows ("all" is capped at two years). */
export function rangeDayCount(range: RangeOption, span: number): number {
  return range.days || Math.min(Math.max(span, 7), 730);
}

export type SeriesKey = "protein" | "carbs" | "fat" | "calories";
export type SeriesPoint = { value: number; label: string };

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Average of `key` per bucket over logged days only. Buckets are daily up
 * to a month, weekly up to ~4 months, monthly beyond — so a year still
 * reads as a chart rather than 365 slivers.
 */
export function bucketSeries(
  days: readonly DayView[],
  key: SeriesKey,
): SeriesPoint[] {
  const count = days.length;
  const step = count <= 31 ? 1 : count <= 120 ? 7 : 30;
  const points: SeriesPoint[] = [];

  for (let start = 0; start < count; start += step) {
    const bucket = days.slice(start, start + step);
    const logged = bucket.filter((day) => day.totals);
    const first = bucket[0];

    if (!first) continue;

    const date = dateFromKey(first.key);
    let label = "";

    if (step === 1) {
      label =
        count <= 7
          ? (WEEKDAY_LETTER[date.getDay()] ?? "")
          : date.getDate() % 5 === 0
            ? String(date.getDate())
            : "";
    } else if (step === 7) {
      label =
        (start / 7) % 2
          ? ""
          : `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
    } else {
      label = MONTH_SHORT[date.getMonth()] ?? "";
    }

    points.push({
      value: logged.length
        ? logged.reduce((sum, day) => sum + (day.totals?.[key] ?? 0), 0) /
          logged.length
        : 0,
      label,
    });
  }

  return points;
}

export type MealSlotSummary = {
  slot: MealSlot;
  calories: number;
  protein: number;
  /** Average "felt" rating 1..3 across days that recorded one; 0 if none. */
  feel: number;
};

/** Per-section averages over logged days, plus the section with the least
 *  protein — fixing the weakest meal beats raising every meal. */
export function mealByMeal(logged: readonly DayView[]): {
  rows: MealSlotSummary[];
  weakest: MealSlotSummary | null;
} {
  if (logged.length === 0) return { rows: [], weakest: null };

  const rows = MEAL_SLOTS.map((slot) => {
    let calories = 0;
    let protein = 0;
    const feels: number[] = [];

    for (const day of logged) {
      for (const meal of day.record?.meals ?? []) {
        if (slotOfMeal(meal) !== slot) continue;
        calories += meal.calories ?? 0;
        protein += meal.protein ?? 0;
      }

      const felt = day.record?.feel[slot];

      if (felt) feels.push(felt);
    }

    return {
      slot,
      calories: calories / logged.length,
      protein: protein / logged.length,
      feel: feels.length
        ? feels.reduce((sum, value) => sum + value, 0) / feels.length
        : 0,
    };
  });

  const weakest =
    [...rows].sort((a, b) => a.protein - b.protein)[0] ?? null;

  return { rows, weakest };
}

/** Days within ±10% of their calorie budget. */
export function daysOnTarget(logged: readonly DayView[]): number {
  return logged.filter(
    (day) =>
      day.totals !== null &&
      Math.abs(day.totals.calories - day.budget) <= day.budget * 0.1,
  ).length;
}

export function averageOf(
  logged: readonly DayView[],
  key: SeriesKey,
): number {
  if (logged.length === 0) return 0;

  return (
    logged.reduce((sum, day) => sum + (day.totals?.[key] ?? 0), 0) /
    logged.length
  );
}

/** Mean confidence across a day's entries (for display/tests). */
export function meanConfidence(meals: readonly Meal[]): number {
  if (meals.length === 0) return 0;

  return (
    meals.reduce((sum, meal) => sum + confidenceOf(meal), 0) / meals.length
  );
}
