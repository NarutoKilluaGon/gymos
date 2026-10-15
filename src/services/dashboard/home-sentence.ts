import { formatNumber } from "@/utils/format";

export type HomeSentenceContext = {
  activeWorkout?: boolean;
  workoutTitle?: string;
  workoutDone?: boolean;
  caloriesEaten?: number;
  calorieTarget?: number;
  steps?: number;
  stepTarget?: number;
  waterL?: number;
  waterTargetL?: number;
};

/**
 * Builds the L · Quiet natural summary sentence below the North Star goal.
 */
export function buildHomeSummarySentence(context: HomeSentenceContext): string {
  const {
    activeWorkout = false,
    workoutTitle,
    workoutDone = false,
    caloriesEaten = 0,
    calorieTarget = 2000,
  } = context;

  const isOverBudget = calorieTarget > 0 && caloriesEaten > calorieTarget;
  const overCalories = Math.round(caloriesEaten - calorieTarget);
  const remainingCalories = Math.max(0, Math.round(calorieTarget - caloriesEaten));

  if (activeWorkout) {
    if (isOverBudget) {
      return `One workout is open and you're ${formatNumber(overCalories)} kcal over today's budget.`;
    }
    const titlePart = workoutTitle ? `${workoutTitle} workout open` : "One workout is open";
    if (remainingCalories > 0) {
      return `${titlePart} · ${formatNumber(remainingCalories)} kcal remaining today.`;
    }
    return `${titlePart} and calorie target reached.`;
  }

  if (workoutDone) {
    if (isOverBudget) {
      return `Workout complete. You're ${formatNumber(overCalories)} kcal over today's budget.`;
    }
    if (remainingCalories > 0) {
      return `Workout complete · ${formatNumber(remainingCalories)} kcal remaining today.`;
    }
    return "Workout complete and calorie target reached.";
  }

  // Rest day or workout not started
  if (isOverBudget) {
    return `You're ${formatNumber(overCalories)} kcal over today's budget.`;
  }

  if (caloriesEaten > 0 && remainingCalories > 0) {
    return `${formatNumber(remainingCalories)} kcal remaining today.`;
  }

  return "All targets on track today.";
}
