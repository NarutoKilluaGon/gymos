import { toDayKey } from "@/services/day-timeline";
import type { CalorieGoal } from "@/storage/repositories/nutrition-targets";
import type { ActivityLevel } from "@/storage/repositories/nutrition-profile";
import type { TimelineItem } from "@/types/timeline";
import { getTodayKey } from "@/utils/date";

/**
 * S7 calorie-target engine. Pure, deterministic, unit-testable:
 *
 *   base maintenance
 *   + today's logged workout expenditure (estimate)
 *   + today's logged voluntary cardio expenditure (stored value first)
 *   = today's estimated maintenance
 *   ± configured goal adjustment (deficit / maintain / surplus)
 *   = today's calorie target
 *
 * Steps are not an input — by construction they cannot move the target
 * (see the S6/S7 regression tests). Burned calories are ESTIMATES, and
 * the summary UI labels them as such; nothing here is exact physiology.
 */

/**
 * Rough placeholder rate for strength-training sessions: the workout
 * event model stores duration but no calories, so a session contributes
 * its minutes at this flat rate. Deliberately simple and clearly
 * labelled — a future slice with better data can replace the constant.
 */
export const ESTIMATED_WORKOUT_KCAL_PER_MIN = 6;

/**
 * Fallback rate for cardio entries without user-logged calories: the
 * cardio event model stores duration always, calories only when the
 * user typed them. A stored calorie value always wins over this rate.
 */
export const ESTIMATED_CARDIO_KCAL_PER_MIN = 8;

/** Default deficit/surplus magnitude when none is configured. */
export const DEFAULT_GOAL_ADJUSTMENT_KCAL = 500;

export type ActivityLevelOption = {
  value: ActivityLevel;
  label: string;
  blurb: string;
  multiplier: number;
};

/**
 * Everyday-activity options for the maintenance calculator. Multipliers
 * are the standard Mifflin-St Jeor activity factors, and each option
 * describes daily life OUTSIDE explicitly logged training — the engine
 * adds logged workout/cardio calories on top of maintenance, so the two
 * must not cover the same activity (see the model note on
 * `estimateMaintenanceCalories`).
 */
export const ACTIVITY_LEVELS: ActivityLevelOption[] = [
  {
    value: "sedentary",
    label: "Sedentary",
    blurb: "Desk job, little movement outside logged training",
    multiplier: 1.2,
  },
  {
    value: "light",
    label: "Lightly active",
    blurb: "Some walking through the day, outside logged training",
    multiplier: 1.375,
  },
  {
    value: "moderate",
    label: "Moderately active",
    blurb: "Often on your feet, outside logged training",
    multiplier: 1.55,
  },
  {
    value: "very",
    label: "Very active",
    blurb: "Physical job or very active days, outside logged training",
    multiplier: 1.725,
  },
];

/**
 * Estimate daily maintenance calories (Mifflin-St Jeor × activity).
 *
 * Model (deliberately single-counted): BMR comes from the equation,
 * the activity multiplier covers BASE daily life only (see
 * ACTIVITY_LEVELS — everyday movement outside logged training), and
 * explicitly logged workout/cardio calories are added separately by
 * `calculateCalorieTarget`. Picking an activity level that already
 * includes the same training would double-count it, hence the labels.
 *
 * This is an ESTIMATE, not a measurement: validated equations on
 * self-reported inputs, rounded to whole kcal. Returns null when any
 * required input is missing or outside a plausible range, so callers
 * fall back to the manually entered maintenance instead of guessing.
 */
export function estimateMaintenanceCalories(profile: {
  ageYears?: unknown;
  sex?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  activityLevel?: unknown;
}): number | null {
  const age =
    typeof profile.ageYears === "number" &&
    Number.isFinite(profile.ageYears)
      ? profile.ageYears
      : NaN;
  const heightCm =
    typeof profile.heightCm === "number" &&
    Number.isFinite(profile.heightCm)
      ? profile.heightCm
      : NaN;
  const weightKg =
    typeof profile.weightKg === "number" &&
    Number.isFinite(profile.weightKg)
      ? profile.weightKg
      : NaN;

  if (
    !(age >= 10 && age <= 100) ||
    !(heightCm >= 100 && heightCm <= 250) ||
    !(weightKg >= 25 && weightKg <= 400) ||
    (profile.sex !== "male" && profile.sex !== "female")
  ) {
    return null;
  }

  const option = ACTIVITY_LEVELS.find(
    (entry) => entry.value === profile.activityLevel,
  );

  if (!option) {
    return null;
  }

  const bmr =
    10 * weightKg +
    6.25 * heightCm -
    5 * age +
    (profile.sex === "male" ? 5 : -161);

  if (!Number.isFinite(bmr) || bmr <= 0) {
    return null;
  }

  return Math.round(bmr * option.multiplier);
}

export type ActivityExpenditure = {
  workoutKcal: number;
  cardioKcal: number;
  totalKcal: number;
  workoutCount: number;
  cardioCount: number;
};

const ZERO_EXPENDITURE: ActivityExpenditure = {
  workoutKcal: 0,
  cardioKcal: 0,
  totalKcal: 0,
  workoutCount: 0,
  cardioCount: 0,
};

/** Finite positive number or 0 — malformed/negative values contribute
 *  nothing instead of poisoning the sum with NaN/Infinity. */
function toPositiveKcal(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Estimate today's training expenditure from event-timeline items.
 * Only `workout` and `cardio` kinds contribute; every other kind
 * (meals, water, sleep, steps-like objects, …) is ignored, as is
 * anything malformed. No day filtering here — pass today's items
 * (or use `calculateCalorieTarget`, which filters).
 */
export function estimateActivityExpenditure(
  items?: readonly unknown[] | null,
): ActivityExpenditure {
  if (!Array.isArray(items)) {
    return { ...ZERO_EXPENDITURE };
  }

  let workoutKcal = 0;
  let cardioKcal = 0;
  let workoutCount = 0;
  let cardioCount = 0;

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    if (item.kind === "workout") {
      workoutCount += 1;
      const minutes =
        toPositiveKcal(item.durationMs) / 60000;
      workoutKcal += Math.round(
        minutes * ESTIMATED_WORKOUT_KCAL_PER_MIN,
      );
    } else if (item.kind === "cardio") {
      cardioCount += 1;
      const stored = toPositiveKcal(item.calories);

      cardioKcal +=
        stored > 0
          ? Math.round(stored)
          : Math.round(
              toPositiveKcal(item.durationMin) *
                ESTIMATED_CARDIO_KCAL_PER_MIN,
            );
    }
  }

  return {
    workoutKcal,
    cardioKcal,
    totalKcal: workoutKcal + cardioKcal,
    workoutCount,
    cardioCount,
  };
}

export type CalorieTargetResult = {
  /** False when no usable maintenance is configured — the caller keeps
   *  showing the static `calories` target instead. */
  hasMaintenance: boolean;
  baseMaintenance: number;
  workoutKcal: number;
  cardioKcal: number;
  /** Workout + cardio. Steps can never appear here (no such input). */
  activityKcal: number;
  estimatedMaintenance: number;
  goal: CalorieGoal;
  /** Signed adjustment applied (e.g. -500 / 0 / +500). */
  adjustmentKcal: number;
  /** Rounded, clamped ≥ 0. Only meaningful when hasMaintenance. */
  targetKcal: number;
};

function resolveGoal(value: unknown): CalorieGoal {
  return value === "deficit" ||
    value === "maintain" ||
    value === "surplus"
    ? value
    : "maintain";
}

/**
 * Calculate today's calorie target from configuration + today's
 * activity. Computed fresh on each call (screen load/focus) — never
 * persisted, so historical meals are untouched and a changing target
 * is never stored as a record. Missing/invalid configuration or
 * activity degrades to safe zeros; outputs are always finite.
 */
export function calculateCalorieTarget(input: {
  maintenanceCalories?: unknown;
  goal?: unknown;
  goalAdjustmentKcal?: unknown;
  timelineItems?: readonly unknown[] | null;
  todayKey?: string;
}): CalorieTargetResult {
  const baseMaintenance = toPositiveKcal(input.maintenanceCalories);
  const hasMaintenance = baseMaintenance > 0;
  const goal = resolveGoal(input.goal);

  const todayKey = input.todayKey ?? getTodayKey();
  const rawItems = Array.isArray(input.timelineItems)
    ? input.timelineItems
    : [];
  const todayItems = rawItems.filter(
    (item) =>
      isRecord(item) &&
      typeof item.timestamp === "string" &&
      toDayKey(item.timestamp) === todayKey,
  );

  const expenditure = estimateActivityExpenditure(todayItems);
  const activityKcal = expenditure.totalKcal;
  const estimatedMaintenance = baseMaintenance + activityKcal;

  const magnitude =
    toPositiveKcal(input.goalAdjustmentKcal) > 0
      ? Math.round(toPositiveKcal(input.goalAdjustmentKcal))
      : DEFAULT_GOAL_ADJUSTMENT_KCAL;
  const adjustmentKcal =
    goal === "deficit" ? -magnitude : goal === "surplus" ? magnitude : 0;

  const targetKcal = Math.max(
    0,
    Math.round(estimatedMaintenance + adjustmentKcal),
  );

  return {
    hasMaintenance,
    baseMaintenance: Math.round(baseMaintenance),
    workoutKcal: expenditure.workoutKcal,
    cardioKcal: expenditure.cardioKcal,
    activityKcal,
    estimatedMaintenance: Math.round(estimatedMaintenance),
    goal,
    adjustmentKcal,
    targetKcal,
  };
}
