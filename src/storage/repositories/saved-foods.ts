import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import { createMutex } from "@/storage/mutex";
import type {
  ID,
  MealFood,
  Micronutrients,
  Timestamp,
} from "@/types/gymos";
import { createId } from "@/utils/id";

const SAVED_FOODS_KEY = "@gymos/saved-foods";
const savedFoodsMutex = createMutex();

async function readSavedFoodsUnlocked(): Promise<SavedFood[]> {
  return (await getStorage<SavedFood[]>(SAVED_FOODS_KEY)) ?? [];
}

export type SavedFood = {
  id: ID;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Complete reusable food breakdown when this entry is a saved MEAL
   *  (S4). Absent for individual saved foods — entries persisted before
   *  this field keep their exact shape and behavior. Everything reuse
   *  needs (totals + breakdown, all 16 nutrients) rides on the record,
   *  so logging it back offline involves no food DB lookup, network, or
   *  recalculation. */
  foods?: MealFood[];
  createdAt: Timestamp;
} & Micronutrients;

export async function getSavedFoods(): Promise<SavedFood[]> {
  return savedFoodsMutex.runExclusive(readSavedFoodsUnlocked);
}

/** True when a saved entry carries a reusable meal breakdown (S4) — the
 *  single source of truth the Add Food shortcuts branch on: meals open
 *  the review pipeline from stored nutrition, individual foods quick-log.
 *  An empty or absent `foods` array means individual food. */
export function isSavedMeal(saved: SavedFood): boolean {
  return saved.foods !== undefined && saved.foods.length > 0;
}

/**
 * Store a reusable entry. Without `foods` this is an individual saved
 * food (existing shape, unchanged). With a non-empty `foods` breakdown
 * it becomes a saved MEAL (S4). This is only ever called from an
 * explicit user action — logging a meal never writes here.
 */
export async function addSavedFood(
  name: string,
  macros?: Partial<
    Pick<SavedFood, "calories" | "protein" | "carbs" | "fat">
  > &
    Micronutrients,
  foods?: MealFood[],
): Promise<SavedFood> {
  return savedFoodsMutex.runExclusive(async () => {
    const existing = await readSavedFoodsUnlocked();

    const food: SavedFood = {
      id: createId(),
      name,
      ...macros,
      ...(foods && foods.length > 0 ? { foods } : {}),
      createdAt: new Date().toISOString(),
    };

    existing.push(food);

    await setStorage(SAVED_FOODS_KEY, existing);

    return food;
  });
}

export async function deleteSavedFood(
  id: string,
): Promise<void> {
  await savedFoodsMutex.runExclusive(async () => {
    const foods = await readSavedFoodsUnlocked();

    await setStorage(
      SAVED_FOODS_KEY,
      foods.filter((f) => f.id !== id),
    );
  });
}
