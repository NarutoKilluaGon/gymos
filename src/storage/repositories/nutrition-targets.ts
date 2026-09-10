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
};

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
