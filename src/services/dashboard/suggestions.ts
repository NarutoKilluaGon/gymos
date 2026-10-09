import { DAILY_TARGETS } from "@/constants/targets";
import type { PlanDay } from "@/types/forge";
import type { Meal, SleepSession, WorkoutSession } from "@/types/gymos";
import { formatNumber, plural } from "@/utils/format";

export type HomeSuggestionAction = {
  type: "workout" | "nutrition" | "water" | "sleep" | "hub";
  route?: string;
};

export type HomeSuggestion = {
  text: string;
  action: HomeSuggestionAction;
};

export type SuggestionInputs = {
  activeWorkout?: WorkoutSession | null;
  plannedDay?: PlanDay | null;
  finishedWorkout?: WorkoutSession | null;
  meals?: Meal[];
  waterLitres?: number;
  protein?: number;
  proteinTarget?: number;
  sleep?: SleepSession[];
  nutritionEnabled?: boolean;
  /** Hour of day 0–23 (defaults to new Date().getHours()) */
  currentHour?: number;
};

export function getHomeSuggestion(inputs: SuggestionInputs): HomeSuggestion {
  const {
    activeWorkout,
    plannedDay,
    finishedWorkout,
    waterLitres = 0,
    protein = 0,
    proteinTarget,
    sleep = [],
    nutritionEnabled = true,
  } = inputs;

  const hour = inputs.currentHour ?? new Date().getHours();

  // 1. Active workout in progress
  if (activeWorkout) {
    return {
      text: `Continue your workout — ${plural(
        activeWorkout.exercises.length,
        "exercise",
      )} logged.`,
      action: { type: "workout", route: "/workouts" },
    };
  }

  // 2. Planned workout not done and before 8 pm (20:00)
  if (plannedDay && !finishedWorkout && hour < 20) {
    return {
      text: `Today: ${plannedDay.name} · ${plural(
        plannedDay.exercises.length,
        "exercise",
      )} ready`,
      action: { type: "workout", route: "/workouts" },
    };
  }

  // 3. After 3 pm (15:00) and protein gap >= 30g
  if (
    nutritionEnabled &&
    proteinTarget &&
    hour >= 15 &&
    proteinTarget - protein >= 30
  ) {
    const gap = Math.round(proteinTarget - protein);
    return {
      text: `${formatNumber(gap)}g protein to go · try a quick shake or snack`,
      action: { type: "nutrition", route: "/nutrition" },
    };
  }

  // 4. Water behind pace for hour of day
  // Never "start your day" after noon (12:00)
  if (waterLitres <= 0 && hour < 12) {
    return {
      text: "Start your day with a glass of water.",
      action: { type: "water" },
    };
  }

  const expectedWaterPace = Math.min(
    1,
    Math.max(0, (hour - 7) / 15),
  ) * DAILY_TARGETS.waterL;

  if (hour >= 10 && waterLitres < expectedWaterPace && waterLitres < DAILY_TARGETS.waterL) {
    const toGo = Number(Math.max(0.1, DAILY_TARGETS.waterL - waterLitres).toFixed(1));
    return {
      text: `${formatNumber(toGo)}L of water to go today`,
      action: { type: "water" },
    };
  }

  // 5. Morning (before 12:00) with no sleep logged
  const hasSleep = sleep.some((s) => s.endedAt !== undefined);
  if (hour < 12 && !hasSleep) {
    return {
      text: "How did you sleep?",
      action: { type: "sleep" },
    };
  }

  // 6. Otherwise on track
  return {
    text: "You're on track today.",
    action: { type: "hub", route: "/hub" },
  };
}
