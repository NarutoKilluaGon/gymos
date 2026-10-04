import { isCompletedWorkout } from "@/services/forge/history";
import { sessionVolumeKg } from "@/services/forge/load";
import { getAllDailyActivities } from "@/storage/daily";
import { getAllMeals } from "@/storage/repositories/meals";
import {
  getLatestMeasurement,
  getMeasurementHistory,
} from "@/storage/repositories/measurements";
import { getNorthStar } from "@/storage/repositories/north-star";
import {
  convertWeight,
  type WeightUnit,
} from "@/storage/repositories/preferences";
import type {
  GoalProgress,
  HeatmapWeek,
  MonthlySummary,
  VolumePoint,
  WeekInsights,
  WeekStats,
} from "@/types/insights";

const WEEKDAYS = 7;

const WEEK_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

function dateKeyOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Total logged calories per local date key, across every meal ever
 * logged. Meals used to live embedded in each day's DailyActivity
 * (`activity.meals`), so a calorie total per day fell out of iterating
 * `getAllDailyActivities()` for free. Now that meals have their own
 * store (see storage/repositories/meals.ts), computing a per-day total
 * needs one pass over `getAllMeals()` instead — done once here and
 * reused by both getWeekInsights and getMonthlySummaries rather than
 * each re-deriving it.
 */
async function caloriesByDateKey(): Promise<Map<string, number>> {
  const meals = await getAllMeals();
  const totals = new Map<string, number>();

  for (const meal of meals) {
    const parsed = new Date(meal.timestamp);

    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    const key = dateKeyOf(parsed);
    totals.set(key, (totals.get(key) ?? 0) + (meal.calories ?? 0));
  }

  return totals;
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - (isoWeekday(result) - 1));
  return result;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString([], { month: "short" });
}

function sundayOf(startDateKey: string): string {
  const start = new Date(`${startDateKey}T00:00:00`);
  start.setDate(start.getDate() + (WEEKDAYS - 1));
  return dateKeyOf(start);
}

/** Last `weeks` worth of completed-workout counts, laid out Mon-starting. */
export async function getHeatmap(
  weeks: number = 17,
): Promise<HeatmapWeek[]> {
  const data = await getAllDailyActivities();

  const counts = new Map<string, number>();

  for (const activity of Object.values(data)) {
    const completed = (activity.workouts ?? []).filter(
      isCompletedWorkout,
    ).length;

    if (completed > 0) {
      counts.set(activity.date, (counts.get(activity.date) ?? 0) + completed);
    }
  }

  const today = new Date();
  const monday = startOfWeek(today);

  const result: HeatmapWeek[] = [];

  let previousMonthKey: string | null = null;

  for (let w = weeks - 1; w >= 0; w -= 1) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() - w * WEEKDAYS);

    const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;

    const label =
      w === 0 || monthKey !== previousMonthKey
        ? monthLabel(weekStart)
        : "";

    previousMonthKey = monthKey;

    const cells = WEEK_LABELS.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);

      const key = dateKeyOf(date);

      return {
        date: key,
        count: counts.get(key) ?? 0,
      };
    });

    result.push({ label, cells });
  }

  return result;
}

export async function getWeekInsights(): Promise<WeekInsights> {
  const [data, calories] = await Promise.all([
    getAllDailyActivities(),
    caloriesByDateKey(),
  ]);

  const now = new Date();
  const currentStart = startOfWeek(now);
  const currentStartMs = currentStart.getTime();

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - WEEKDAYS);
  const previousStartMs = previousStart.getTime();

  const stats: Record<"current" | "previous", WeekStats> = {
    current: emptyStats(currentStart),
    previous: emptyStats(previousStart),
  };

  for (const [dateKey, activity] of Object.entries(data)) {
    const dayTime =
      new Date(`${dateKey}T00:00:00`).getTime();

    let bucket: WeekStats | null = null;

    if (dayTime >= currentStartMs) {
      bucket = stats.current;
    } else if (dayTime >= previousStartMs) {
      bucket = stats.previous;
    }

    if (!bucket) {
      continue;
    }

    const completedWorkouts = (activity.workouts ?? []).filter(
      isCompletedWorkout,
    );

    if (completedWorkouts.length > 0) {
      bucket.workoutDays += 1;
      bucket.workouts += completedWorkouts.length;
      bucket.minutes += completedWorkouts.reduce((sum, workout) => {
        const start = new Date(workout.startedAt).getTime();
        const end = new Date(workout.endedAt!).getTime();
        return sum + Math.round((end - start) / 60000);
      }, 0);
    }

    const dayCalories = calories.get(dateKey) ?? 0;

    if (dayCalories > 0) {
      bucket.calorieDays += 1;
      bucket.caloriesAverage =
        (bucket.caloriesAverage ?? 0) + dayCalories;
    }

    bucket.journalCount += (activity.journal ?? []).length;
  }

  for (const key of ["current", "previous"] as const) {
    const bucket = stats[key];

    bucket.endDate = sundayOf(bucket.startDate);

    if (bucket.calorieDays > 0) {
      bucket.caloriesAverage = Math.round(
        bucket.caloriesAverage! / bucket.calorieDays,
      );
    }
  }

  // Weight — latest value per week for the delta comparison.
  const weightHistory = await getMeasurementHistory("weight");

  for (const key of ["current", "previous"] as const) {
    const bucket = stats[key];

    const weekStart = new Date(
      `${bucket.startDate}T00:00:00`,
    ).getTime();
    const weekEnd = new Date(
      `${bucket.endDate}T23:59:59.999`,
    ).getTime();

    const inWeek = weightHistory.filter(
      (m) => {
        const time = new Date(m.timestamp).getTime();
        return time >= weekStart && time <= weekEnd;
      },
    );

    if (inWeek.length >= 1) {
      bucket.weightLatest =
        inWeek[inWeek.length - 1].value;
      bucket.weightUnit =
        inWeek[inWeek.length - 1].unit;

      if (inWeek.length >= 2) {
        // Mixed kg/lb weeks: convert the earlier reading into the latest
        // reading's unit (the unit this delta is displayed in).
        bucket.weightChange =
          inWeek[inWeek.length - 1].value -
          convertWeight(
            inWeek[0].value,
            inWeek[0].unit as WeightUnit,
            inWeek[inWeek.length - 1].unit as WeightUnit,
          );
      }
    }
  }

  return { current: stats.current, previous: stats.previous };
}

function emptyStats(
  startOfWeek: Date,
): WeekStats {
  return {
    startDate: dateKeyOf(startOfWeek),
    endDate: "",
    workoutDays: 0,
    workouts: 0,
    minutes: 0,
    weightLatest: null,
    weightUnit: null,
    weightChange: null,
    caloriesAverage: null,
    calorieDays: 0,
    journalCount: 0,
  };
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  gainMuscle: "Gain muscle",
  loseWeight: "Lose weight",
  buildStrength: "Build strength",
  maintainWeight: "Maintain weight",
  improveEndurance: "Improve endurance",
};

function monthLabelFull(date: Date): string {
  return `${monthLabel(date)} ${date.getFullYear()}`;
}

export async function getMonthlySummaries(
  months: number = 6,
): Promise<MonthlySummary[]> {
  const [data, calories] = await Promise.all([
    getAllDailyActivities(),
    caloriesByDateKey(),
  ]);

  const now = new Date();

  const keys: string[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1,
    );

    keys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  type Bucket = {
    workoutDayKeys: Set<string>;
    workouts: number;
    minutes: number;
    calorieDays: number;
    caloriesSum: number;
    journalCount: number;
  };

  const buckets = new Map<string, Bucket>();

  for (const [dateKey, activity] of Object.entries(data)) {
    const monthKey = dateKey.slice(0, 7);

    if (!keys.includes(monthKey)) {
      continue;
    }

    const bucket =
      buckets.get(monthKey) ??
      {
        workoutDayKeys: new Set<string>(),
        workouts: 0,
        minutes: 0,
        calorieDays: 0,
        caloriesSum: 0,
        journalCount: 0,
      };

    const completedWorkouts = (activity.workouts ?? []).filter(
      isCompletedWorkout,
    );

    if (completedWorkouts.length > 0) {
      bucket.workoutDayKeys.add(dateKey);
      bucket.workouts += completedWorkouts.length;
      bucket.minutes += completedWorkouts.reduce((sum, workout) => {
        const start = new Date(workout.startedAt).getTime();
        const end = new Date(workout.endedAt!).getTime();

        return sum + Math.round((end - start) / 60000);
      }, 0);
    }

    const dayCalories = calories.get(dateKey) ?? 0;

    if (dayCalories > 0) {
      bucket.calorieDays += 1;
      bucket.caloriesSum += dayCalories;
    }

    bucket.journalCount += (activity.journal ?? []).length;

    buckets.set(monthKey, bucket);
  }

  const weightChangeByMonth = new Map<
    string,
    { change: number; unit: string }
  >();

  const weightHistory = await getMeasurementHistory("weight");

  for (const [monthKey] of buckets) {
    const inMonth = weightHistory.filter((m) => {
      const time = new Date(m.timestamp).getTime();
      const start = new Date(
        `${monthKey}-01T00:00:00`,
      ).getTime();
      const end = new Date(`${monthKey}-01T00:00:00`);

      end.setMonth(end.getMonth() + 1);

      const endMs = end.getTime();

      return time >= start && time < endMs;
    });

    if (inMonth.length >= 2) {
      // Mixed kg/lb months: convert the first reading into the latest
      // reading's unit (the unit this change is displayed in).
      weightChangeByMonth.set(monthKey, {
        change:
          inMonth[inMonth.length - 1].value -
          convertWeight(
            inMonth[0].value,
            inMonth[0].unit as WeightUnit,
            inMonth[inMonth.length - 1].unit as WeightUnit,
          ),
        unit: inMonth[inMonth.length - 1].unit,
      });
    }
  }

  return keys.map((monthKey) => {
    const bucket = buckets.get(monthKey);
    const year = Number(monthKey.slice(0, 4));
    const monthIndex = Number(monthKey.slice(5)) - 1;

    const weight = weightChangeByMonth.get(monthKey);

    return {
      monthKey,
      label: monthLabelFull(
        new Date(year, monthIndex, 1),
      ),
      workouts: bucket?.workouts ?? 0,
      workoutDays: bucket?.workoutDayKeys.size ?? 0,
      minutes: bucket?.minutes ?? 0,
      caloriesAverage:
        bucket && bucket.calorieDays > 0
          ? Math.round(bucket.caloriesSum / bucket.calorieDays)
          : null,
      calorieDays: bucket?.calorieDays ?? 0,
      weightChange: weight?.change ?? null,
      weightUnit: weight?.unit ?? null,
      journalCount: bucket?.journalCount ?? 0,
    };
  });
}

/**
 * Lifting volume per week (kg), Mon-starting, oldest first, using the same
 * definition as Forge and History (`sessionVolumeKg`). Weeks with no
 * completed work sets are 0.
 */
export async function getVolumeTrend(
  weeks: number = 12,
): Promise<VolumePoint[]> {
  const data = await getAllDailyActivities();

  const dayVolume = new Map<string, number>();

  for (const activity of Object.values(data)) {
    // "Finished" as Forge defines it (`finishedSessions`): has `endedAt`.
    const completed = (activity.workouts ?? []).filter((workout) =>
      Boolean(workout?.endedAt),
    );

    if (completed.length === 0) {
      continue;
    }

    let total = 0;

    for (const workout of completed) {
      // The same definition History and Forge use (kg, completed non-warm-up
      // sets, unit-converted, bodyweight-aware). Missing arrays on a
      // malformed record read as empty rather than throwing.
      total += sessionVolumeKg({
        ...workout,
        exercises: (workout.exercises ?? []).map((exercise) => ({
          ...exercise,
          sets: exercise.sets ?? [],
        })),
      });
    }

    dayVolume.set(activity.date, total);
  }

  const today = new Date();
  const monday = startOfWeek(today);

  const result: VolumePoint[] = [];

  for (let w = weeks - 1; w >= 0; w -= 1) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() - w * WEEKDAYS);

    const key = dateKeyOf(weekStart);
    const startMs =
      new Date(`${key}T00:00:00`).getTime();
    const endMs = startMs + WEEKDAYS * 86400000;

    let volume = 0;

    for (const [dayKey, dayTotal] of dayVolume) {
      const dayMs =
        new Date(`${dayKey}T00:00:00`).getTime();

      if (dayMs >= startMs && dayMs < endMs) {
        volume += dayTotal;
      }
    }

    result.push({
      weekKey: key,
      label: weekStart
        .toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
      volume,
    });
  }

  return result;
}

export async function getNorthStarProgress(): Promise<GoalProgress | null> {
  const northStar = await getNorthStar();

  const bound =
    northStar.metric !== undefined &&
    northStar.targetValue !== undefined &&
    northStar.unit !== undefined;

  if (!bound) {
    return null;
  }

  const latest = northStar.metric
    ? await getLatestMeasurement(northStar.metric)
    : undefined;

  const current = latest?.value ?? null;
  const storedTarget = northStar.targetValue!;
  const unit = latest?.unit ?? northStar.unit!;
  // current and target are rendered under a single unit label — convert
  // the stored target into that unit for the math and display. The stored
  // target itself is never rewritten here.
  const target =
    northStar.unit !== unit &&
    (northStar.unit === "kg" || northStar.unit === "lb") &&
    (unit === "kg" || unit === "lb")
      ? convertWeight(storedTarget, northStar.unit, unit)
      : storedTarget;

  let percent = 0;

  if (current !== null && current > 0 && target > 0) {
    const descending = northStar.goalType === "loseWeight";

    const fraction = descending ? target / current : current / target;

    percent = Math.round(
      Math.min(Math.max(fraction, 0), 1) * 100,
    );
  }

  return {
    hasTarget: true,
    title: northStar.title,
    why: northStar.why,
    goalType: northStar.goalType,
    goalTypeLabel:
      northStar.goalType !== undefined
        ? GOAL_TYPE_LABELS[northStar.goalType]
        : undefined,
    metric: northStar.metric!,
    current,
    target,
    unit,
    percent,
    direction:
      northStar.goalType === "loseWeight"
        ? "descending"
        : "ascending",
  };
}

/** Plain-English lines that answer "how is the week going?". */
export function buildInsightLines(
  insights: WeekInsights,
): string[] {
  const lines: string[] = [];

  const { current, previous } = insights;

  // Workout consistency.
  if (current.workoutDays === 0) {
    lines.push("No workouts logged this week yet.");
  } else if (previous.workoutDays === 0 && previous.workouts === 0) {
    lines.push(
      `You trained ${current.workoutDays} day${current.workoutDays === 1 ? "" : "s"} this week.`,
    );
  } else {
    const delta = current.workoutDays - previous.workoutDays;
    const days =
      `${current.workoutDays} day${current.workoutDays === 1 ? "" : "s"}`;
    const comparison =
      delta > 0
        ? `${signed(delta)} vs last week`
        : delta < 0
          ? `${delta} vs last week`
          : "same as last week";

    lines.push(
      `You trained ${days} this week — ${comparison}.`,
    );
  }

  // Weight movement.
  if (current.weightChange !== null) {
    const unit = current.weightUnit ?? "kg";

    lines.push(
      `Weight moved ${signed(current.weightChange)} ${unit} this week.`,
    );
  }

  // Nutrition consistency.
  if (current.calorieDays >= 2) {
    lines.push(
      `Average ${current.caloriesAverage} kcal/day across ${current.calorieDays} logged days.`,
    );
  }

  return lines;
}