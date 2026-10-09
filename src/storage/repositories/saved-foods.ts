import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import { createMutex } from "@/storage/mutex";
import { normalizeFoodName } from "@/services/food-db";
import type {
  ID,
  MealFood,
  MealSlot,
  Micronutrients,
  Timestamp,
} from "@/types/gymos";
import { NUTRIENT_KEYS } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { createId } from "@/utils/id";

const SAVED_FOODS_KEY = "@gymos/saved-foods";
const savedFoodsMutex = createMutex();

async function readSavedFoodsUnlocked(): Promise<SavedFood[]> {
  const stored = await getStorage<SavedFood[]>(SAVED_FOODS_KEY);

  return Array.isArray(stored) ? stored : [];
}

/**
 * One reusable entry. Three kinds share the record:
 *  - a food (no `foods`): remembered automatically every time the user
 *    confirms one, so the next log of it reuses THEIR portion and numbers
 *  - a saved meal (`foods` non-empty): a set of entries logged together
 *  - a recipe (`recipe: true`): a per-serving food built from ingredients
 * Every field added for the diary is optional, so entries saved before it
 * load unchanged.
 */
export type SavedFood = {
  id: ID;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Complete reusable breakdown when this entry is a saved MEAL. */
  foods?: MealFood[];
  /** Portion the numbers describe ("2 rotis"). */
  qty?: string;
  /** Times this food has been confirmed; drives "usual foods" ordering. */
  uses?: number;
  lastUsedAt?: Timestamp;
  /** Diary section a saved meal belongs to. */
  slot?: MealSlot;
  /** A per-serving food computed from a recipe's ingredients. */
  recipe?: boolean;
  ingredients?: DraftItem[];
  servings?: number;
  createdAt: Timestamp;
} & Micronutrients;

export async function getSavedFoods(): Promise<SavedFood[]> {
  return savedFoodsMutex.runExclusive(readSavedFoodsUnlocked);
}

/** True when a saved entry carries a reusable meal breakdown. */
export function isSavedMeal(saved: SavedFood): boolean {
  return saved.foods !== undefined && saved.foods.length > 0;
}

export type SavedFoodExtras = {
  qty?: string;
  slot?: MealSlot;
  recipe?: boolean;
  ingredients?: DraftItem[];
  servings?: number;
};

/**
 * Store a reusable entry explicitly (the user asked to save it). Without
 * `foods` this is an individual food; with a non-empty breakdown it is a
 * saved meal.
 */
export async function addSavedFood(
  name: string,
  macros?: Partial<
    Pick<SavedFood, "calories" | "protein" | "carbs" | "fat">
  > &
    Micronutrients,
  foods?: MealFood[],
  extras?: SavedFoodExtras,
): Promise<SavedFood> {
  return savedFoodsMutex.runExclusive(async () => {
    const existing = await readSavedFoodsUnlocked();

    const food: SavedFood = {
      id: createId(),
      name,
      ...macros,
      ...(foods && foods.length > 0 ? { foods } : {}),
      ...extras,
      createdAt: new Date().toISOString(),
    };

    existing.push(food);

    await setStorage(SAVED_FOODS_KEY, existing);

    return food;
  });
}

/**
 * Save a recipe, replacing every existing recipe with the same normalized
 * name ("Rajma" and "rajma" are one recipe). The whole replacement is one
 * locked read-modify-write with a single persisted write: if that write
 * fails nothing changes (the old recipe survives), overlapping calls
 * serialize (exactly one matching recipe remains), and no reader can see
 * the list with the recipe missing. Duplicates already stored under the
 * name collapse into the replacement. Saved meals, plain foods and
 * differently named recipes are never touched.
 *
 * The replacement is a new entry (new id, new createdAt), as before.
 */
export async function replaceRecipe(
  name: string,
  macros?: Partial<
    Pick<SavedFood, "calories" | "protein" | "carbs" | "fat">
  > &
    Micronutrients,
  ingredients?: readonly DraftItem[],
  servings?: number,
): Promise<SavedFood> {
  return savedFoodsMutex.runExclusive(async () => {
    const existing = await readSavedFoodsUnlocked();
    const key = normalizeFoodName(name);

    const recipe: SavedFood = {
      id: createId(),
      name,
      ...macros,
      qty: "1 serving",
      recipe: true,
      ...(ingredients && ingredients.length > 0
        ? { ingredients: [...ingredients] }
        : {}),
      ...(servings !== undefined ? { servings } : {}),
      createdAt: new Date().toISOString(),
    };

    await setStorage(SAVED_FOODS_KEY, [
      ...existing.filter(
        (entry) => !(entry.recipe && normalizeFoodName(entry.name) === key),
      ),
      recipe,
    ]);

    return recipe;
  });
}

export type RememberedFood = {
  name: string;
  qty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} & Micronutrients;

/**
 * Remember foods the user just confirmed. Matching is by normalized name
 * (so "Rotis" and "roti" are one food): an existing individual food has
 * its numbers refreshed to the latest confirmed portion and its use count
 * bumped; a new one is added. Saved meals and recipes are never touched.
 * One read-modify-write for the whole batch.
 */
export async function rememberFoods(
  foods: readonly RememberedFood[],
): Promise<void> {
  if (foods.length === 0) {
    return;
  }

  await savedFoodsMutex.runExclusive(async () => {
    const existing = await readSavedFoodsUnlocked();
    const now = new Date().toISOString();

    for (const food of foods) {
      const key = normalizeFoodName(food.name);

      if (!key) continue;

      const index = existing.findIndex(
        (entry) =>
          !isSavedMeal(entry) &&
          !entry.recipe &&
          normalizeFoodName(entry.name) === key,
      );
      const current = index === -1 ? undefined : existing[index];
      const nutrition: Record<string, number> = {};

      for (const nutrient of NUTRIENT_KEYS) {
        const value = (food as Record<string, unknown>)[nutrient];

        if (typeof value === "number" && Number.isFinite(value)) {
          nutrition[nutrient] = value;
        }
      }

      const next: SavedFood = {
        ...(current ?? { id: createId(), createdAt: now }),
        name: current?.name ?? food.name,
        ...nutrition,
        qty: food.qty,
        uses: (current?.uses ?? 0) + 1,
        lastUsedAt: now,
      };

      if (current) existing[index] = next;
      else existing.push(next);
    }

    await setStorage(SAVED_FOODS_KEY, existing);
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

export async function restoreSavedFood(
  food: SavedFood,
  index?: number,
): Promise<void> {
  await savedFoodsMutex.runExclusive(async () => {
    const foods = await readSavedFoodsUnlocked();
    if (!foods.some((f) => f.id === food.id)) {
      if (typeof index === "number" && index >= 0 && index <= foods.length) {
        foods.splice(index, 0, food);
      } else {
        foods.push(food);
      }
      await setStorage(SAVED_FOODS_KEY, foods);
    }
  });
}
