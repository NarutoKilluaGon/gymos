import {
  getStorage,
  setStorage,
} from "@/storage/storage";

const NUTRITION_PROFILE_KEY = "@gymos/nutrition-profile";

/** Biological sex used by the Mifflin-St Jeor equation. */
export type ProfileSex = "male" | "female";

/**
 * Everyday (non-training) activity level. These describe daily life
 * OUTSIDE explicitly logged workouts/cardio — the calorie-target engine
 * adds logged training on top, so picking a level that already includes
 * the same training would double-count it.
 */
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very";

/** Inputs for the maintenance-calorie calculator. All optional: a
 *  missing/invalid field simply means "not configured yet". */
export type NutritionProfile = {
  ageYears?: number;
  sex?: ProfileSex;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
};

export async function getNutritionProfile(): Promise<NutritionProfile> {
  return (
    (await getStorage<NutritionProfile>(
      NUTRITION_PROFILE_KEY,
    )) ?? {}
  );
}

export async function saveNutritionProfile(
  profile: NutritionProfile,
): Promise<void> {
  await setStorage(NUTRITION_PROFILE_KEY, profile);
}
