import { daysOnTarget, mealByMeal, type DayView } from "@/services/nourish/insights";
import { suggestCalorieAdjustment } from "@/services/nourish/weight";
import type { NourishSettings } from "@/types/nourish";
import { dateFromKey } from "@/utils/date";

export type WeeklyRead = {
  summary: string;
  actions: { do: string; why: string }[];
  /** Logged days the read is based on. */
  basedOnDays: number;
};

const MIN_DAYS = 3;
const MAX_ACTIONS = 3;
const FEEL_HUNGRY_BELOW = 1.6;
const MIN_FEEL_RATINGS = 3;

const round = (value: number) => Math.round(value);
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Patterns and actions from the last two weeks, derived only from what
 * was logged: weakest-protein meal, meals that left you hungry, weekend
 * drift and the weight trend. With too little data it says so rather than
 * inventing a story.
 */
export function buildWeeklyRead(input: {
  /** Last 14 days, oldest first (logged or not). */
  days: readonly DayView[];
  settings: Pick<NourishSettings, "kcal" | "protein" | "weeklyRate">;
  /** kg/week from recent weigh-ins, or null when there is no trend yet. */
  weightSlope: number | null;
}): WeeklyRead {
  const logged = input.days.filter((day) => day.totals !== null);

  if (logged.length < MIN_DAYS) {
    return {
      summary: `Only ${plural(logged.length, "day")} logged in the last two weeks, which is too little to spot patterns. Log a few more days and this read will get sharper.`,
      actions: [],
      basedOnDays: logged.length,
    };
  }

  const mean = (pick: (day: DayView) => number) =>
    logged.reduce((sum, day) => sum + pick(day), 0) / logged.length;
  const avgCalories = mean((day) => day.totals?.calories ?? 0);
  const avgProtein = mean((day) => day.totals?.protein ?? 0);
  const onTarget = daysOnTarget(logged);
  const { rows, weakest } = mealByMeal(logged);

  const actions: { do: string; why: string }[] = [];
  const notes: string[] = [];

  if (input.weightSlope !== null) {
    const adjustment = suggestCalorieAdjustment(
      input.settings.weeklyRate,
      input.weightSlope,
    );

    if (adjustment !== 0) {
      actions.push({
        do: `Change your calorie target by ${adjustment > 0 ? "+" : ""}${adjustment} kcal a day`,
        why: `Your weight is moving ${input.weightSlope >= 0 ? "+" : ""}${input.weightSlope.toFixed(2)} kg/week against a ${input.settings.weeklyRate >= 0 ? "+" : ""}${input.settings.weeklyRate} kg/week goal.`,
      });
    } else {
      notes.push("Your weight trend matches your goal.");
    }
  }

  if (avgProtein < input.settings.protein * 0.9) {
    const gap = round(input.settings.protein - avgProtein);

    actions.push({
      do: weakest
        ? `Add about ${gap}g of protein, starting with ${weakest.slot}`
        : `Add about ${gap}g of protein a day`,
      why: weakest
        ? `You average ${round(avgProtein)}g against a ${input.settings.protein}g target, and ${weakest.slot} is your lightest meal at ${round(weakest.protein)}g.`
        : `You average ${round(avgProtein)}g against a ${input.settings.protein}g target.`,
    });
  } else {
    notes.push(`Protein is on target at ${round(avgProtein)}g a day.`);
  }

  const hungry = rows.find((row) => {
    const ratings = logged.filter((day) => day.record?.feel[row.slot]).length;

    return (
      ratings >= MIN_FEEL_RATINGS &&
      row.feel > 0 &&
      row.feel < FEEL_HUNGRY_BELOW
    );
  });

  if (hungry) {
    actions.push({
      do: `Make ${hungry.slot} more filling`,
      why: `You usually rate it "Still hungry". More protein or fiber there should help.`,
    });
  }

  const weekend = logged.filter((day) => {
    const dow = dateFromKey(day.key).getDay();

    return dow === 0 || dow === 6;
  });
  const weekday = logged.filter((day) => !weekend.includes(day));

  if (weekend.length >= 2 && weekday.length >= 4) {
    const weekendAvg =
      weekend.reduce((sum, day) => sum + (day.totals?.calories ?? 0), 0) /
      weekend.length;
    const weekdayAvg =
      weekday.reduce((sum, day) => sum + (day.totals?.calories ?? 0), 0) /
      weekday.length;
    const drift = weekendAvg - weekdayAvg;

    if (Math.abs(drift) > weekdayAvg * 0.1) {
      actions.push({
        do: "Plan weekend meals ahead",
        why: `Weekends run ${round(Math.abs(drift))} kcal ${drift > 0 ? "higher" : "lower"} than weekdays.`,
      });
    }
  }

  const summary = [
    `Across ${plural(logged.length, "logged day")} you averaged ${round(avgCalories)} kcal and ${round(avgProtein)}g protein, landing within 10% of your budget on ${onTarget}.`,
    ...notes,
  ].join(" ");

  return {
    summary,
    actions: actions.slice(0, MAX_ACTIONS),
    basedOnDays: logged.length,
  };
}
