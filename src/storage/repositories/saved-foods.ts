import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import type { ID, Timestamp } from "@/types/gymos";
import { createId } from "@/utils/id";

const SAVED_FOODS_KEY = "@gymos/saved-foods";

export type SavedFood = {
  id: ID;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  createdAt: Timestamp;
};

export async function getSavedFoods(): Promise<SavedFood[]> {
  return (await getStorage<SavedFood[]>(SAVED_FOODS_KEY)) ?? [];
}

export async function addSavedFood(
  name: string,
  macros?: Partial<
    Pick<SavedFood, "calories" | "protein" | "carbs" | "fat">
  >,
): Promise<SavedFood> {
  const foods = await getSavedFoods();

  const food: SavedFood = {
    id: createId(),
    name,
    ...macros,
    createdAt: new Date().toISOString(),
  };

  foods.push(food);

  await setStorage(SAVED_FOODS_KEY, foods);

  return food;
}

export async function deleteSavedFood(
  id: string,
): Promise<void> {
  const foods = await getSavedFoods();

  await setStorage(
    SAVED_FOODS_KEY,
    foods.filter((f) => f.id !== id),
  );
}
