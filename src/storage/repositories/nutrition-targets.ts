import {
  getStorage,
  setStorage,
} from "@/storage/storage";

const NUTRITION_TARGETS_KEY =
  "@gymos/nutrition-targets";

export type NutritionTargets = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /**
   * S7: base daily maintenance (kcal) the calorie-target engine builds
   * on. Absent for every record saved before this field existed — the
   * engine then reports no maintenance and the summary keeps showing
   * the static `calories` target, so old data behaves exactly as before.
   * Never derived from steps.
   */
  maintenanceCalories?: number;
  /** S7: weight-goal direction applied to the estimated maintenance. */
  calorieGoal?: CalorieGoal;
  /**
   * S7: magnitude (kcal) of the deficit/surplus adjustment. Defaults to
   * DEFAULT_GOAL_ADJUSTMENT_KCAL in the engine when unset.
   */
  goalAdjustmentKcal?: number;
};

/**
 * S7: weight-goal direction for the calorie-target engine. Stored on
 * the same nutrition-targets record as the macro targets — one source
 * of truth, no second settings system.
 */
export type CalorieGoal = "deficit" | "maintain" | "surplus";

export async function getNutritionTargets(): Promise<NutritionTargets> {
  return (
    (await getStorage<NutritionTargets>(
      NUTRITION_TARGETS_KEY,
    )) ?? {}
  );
}

export async function saveNutritionTargets(
  targets: NutritionTargets,
): Promise<void> {
  await setStorage(NUTRITION_TARGETS_KEY, targets);
}
