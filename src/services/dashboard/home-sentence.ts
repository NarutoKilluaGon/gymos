import { formatNumber } from "@/utils/format";

export type HomeSentenceContext = {
  activeWorkout?: boolean;
  workoutTitle?: string;
  workoutDone?: boolean;
  isRestDay?: boolean;
  noWorkout?: boolean;
  caloriesEaten?: number;
  calorieTarget?: number;
  caloriesRemaining?: number;
  proteinEaten?: number;
  proteinTarget?: number;
  proteinRemaining?: number;
  steps?: number;
  stepTarget?: number;
  waterL?: number;
  waterTargetL?: number;
  waterRemainingL?: number;
  sleepHours?: number;
  currentHour?: number;
};

/**
 * Builds the L · Quiet natural summary sentence below the North Star goal.
 * Strict priority order:
 * 1. active workout + over budget: "One workout is open and you're 1,447 kcal over today's budget."
 * 2. active workout + under budget: "One workout is open and you have 420 kcal remaining."
 * 3. workout done + over budget: "Push done. You're 320 kcal over today's budget."
 * 4. workout done + under budget: "Push done. 840 kcal remaining today."
 * 5. rest day / no workout + over budget: "Rest day. You're 210 kcal over today's budget."
 * 6. rest day / no workout + under budget: "Rest day. 1,210 kcal remaining today."
 * 7. protein target missed late in day (>8pm, >25g remaining): "28g protein remaining to hit your target."
 * 8. water low (>1.5L remaining late in day): "1.8 L water remaining today."
 * 9. sleep logged: "7.5 hrs sleep logged last night."
 * 10. default fallback: "All quiet today."
 */
export function buildHomeSummarySentence(context: HomeSentenceContext): string {
  const {
    activeWorkout = false,
    workoutTitle,
    workoutDone = false,
    isRestDay,
    noWorkout,
    caloriesEaten,
    calorieTarget = 2000,
    caloriesRemaining,
    proteinEaten,
    proteinTarget,
    waterL,
    waterTargetL = 3.5,
    sleepHours,
    currentHour,
  } = context;

  const eatenKcal = caloriesEaten ?? 0;
  const isOverBudget = calorieTarget > 0 && eatenKcal > calorieTarget;
  const overCalories = Math.round(eatenKcal - calorieTarget);
  const remainingKcal =
    caloriesRemaining !== undefined
      ? caloriesRemaining
      : Math.max(0, Math.round(calorieTarget - eatenKcal));

  // 1. active workout + over budget
  if (activeWorkout && isOverBudget) {
    return `One workout is open and you're ${formatNumber(overCalories)} kcal over today's budget.`;
  }

  // 2. active workout + under budget
  if (activeWorkout) {
    return `One workout is open and you have ${formatNumber(remainingKcal)} kcal remaining.`;
  }

  // 3. workout done + over budget
  const title = workoutTitle || "Push";
  if (workoutDone && isOverBudget) {
    return `${title} done. You're ${formatNumber(overCalories)} kcal over today's budget.`;
  }

  // 4. workout done + under budget
  if (workoutDone) {
    return `${title} done. ${formatNumber(remainingKcal)} kcal remaining today.`;
  }

  // 5. rest day / no workout + over budget
  const isRestOrNoWorkout = Boolean(
    isRestDay || noWorkout || (!activeWorkout && !workoutDone)
  );

  if (isRestOrNoWorkout && isOverBudget) {
    return `Rest day. You're ${formatNumber(overCalories)} kcal over today's budget.`;
  }

  const hour = currentHour ?? new Date().getHours();
  const isLate = hour >= 20;

  const protRemaining =
    context.proteinRemaining !== undefined
      ? context.proteinRemaining
      : proteinTarget !== undefined && proteinEaten !== undefined
        ? Math.max(0, proteinTarget - proteinEaten)
        : 0;

  const waterRemaining =
    context.waterRemainingL !== undefined
      ? context.waterRemainingL
      : waterTargetL !== undefined && waterL !== undefined
        ? Math.max(0, waterTargetL - waterL)
        : 0;

  // 6. rest day / no workout + under budget
  // Fires when on rest day / no workout and calories are logged / explicit remaining,
  // unless late in day with an actionable protein/water alert.
  const hasCalorieData =
    caloriesRemaining !== undefined ||
    (caloriesEaten !== undefined && caloriesEaten > 0) ||
    isRestDay === true;

  const hasLateAlert = isLate && (protRemaining > 25 || waterRemaining > 1.5);

  if (isRestOrNoWorkout && remainingKcal > 0 && hasCalorieData && !hasLateAlert) {
    return `Rest day. ${formatNumber(remainingKcal)} kcal remaining today.`;
  }

  // 7. protein target missed late in day (>8pm, >25g remaining)
  if (isLate && protRemaining > 25) {
    return `${formatNumber(Math.round(protRemaining))}g protein remaining to hit your target.`;
  }

  // 8. water low (>1.5L remaining late in day)
  if (isLate && waterRemaining > 1.5) {
    return `${waterRemaining.toFixed(1)} L water remaining today.`;
  }

  // 9. sleep logged
  if (sleepHours !== undefined && sleepHours > 0) {
    return `${sleepHours} hrs sleep logged last night.`;
  }

  // If calorie data exists but no late alert fired (e.g. rest day under budget fallback)
  if (isRestOrNoWorkout && remainingKcal > 0 && hasCalorieData) {
    return `Rest day. ${formatNumber(remainingKcal)} kcal remaining today.`;
  }

  // 10. default fallback
  return "All quiet today.";
}
