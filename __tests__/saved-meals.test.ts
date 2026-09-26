import {
  mealInputFromEstimate,
  savedFoodToEstimate,
} from "@/services/meal-estimator";
import { addMeal, getTodayMeals } from "@/storage/repositories/meals";
import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import { NUTRIENT_KEYS, pickMicronutrients } from "@/types/gymos";
import type { MealFood } from "@/types/gymos";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
  };

  return {
    getStorage: jest.fn(async (key: string): Promise<unknown> => {
      const raw = state.store[key];
      return raw === undefined ? null : JSON.parse(raw);
    }),
    setStorage: jest.fn(
      async (key: string, value: unknown): Promise<void> => {
        state.store[key] = JSON.stringify(value);
      },
    ),
    removeStorage: jest.fn(async (key: string): Promise<void> => {
      delete state.store[key];
    }),
    StorageError: class StorageError extends Error {},
    __reset() {
      state.store = {};
    },
    __seed(key: string, value: unknown) {
      state.store[key] = JSON.stringify(value);
    },
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __reset(): void;
  __seed(key: string, value: unknown): void;
};

const SAVED_FOODS_KEY = "@gymos/saved-foods";

beforeEach(() => {
  storageMock.__reset();
});

/** A complete two-food breakdown with all 16 nutrients + an additional. */
const breakdown: MealFood[] = [
  {
    name: "Masala dosa",
    amount: 1,
    unit: "piece",
    calories: 250,
    protein: 4,
    carbs: 40,
    fat: 9,
    fiber: 2,
    sodium: 380,
    potassium: 90,
    calcium: 20,
    iron: 1,
    magnesium: 25,
    zinc: 0.4,
    vitaminA: 60,
    vitaminC: 2,
    vitaminD: 0,
    vitaminB12: 0,
    folate: 15,
    additionals: [
      {
        id: "add-ghee",
        entryId: "ghee",
        name: "Ghee",
        amount: 1,
        unit: "tbsp",
        calories: 135,
        protein: 0,
        carbs: 0,
        fat: 15,
      },
    ],
  },
  {
    name: "Sambar",
    amount: 150,
    unit: "ml",
    calories: 170,
    protein: 6,
    carbs: 28,
    fat: 4,
    fiber: 6,
    sodium: 640,
    potassium: 380,
    calcium: 40,
    iron: 1.2,
    magnesium: 30,
    zinc: 0.6,
    vitaminA: 240,
    vitaminC: 8,
    vitaminD: 0,
    vitaminB12: 0.2,
    folate: 55,
  },
];

/** Meal-level totals a review sheet would store for the breakdown. */
const mealTotals = {
  calories: 420,
  protein: 10,
  carbs: 68,
  fat: 13,
  fiber: 8,
  sodium: 1020,
  potassium: 470,
  calcium: 60,
  iron: 2.2,
  magnesium: 55,
  zinc: 1,
  vitaminA: 300,
  vitaminC: 10,
  vitaminD: 0,
  vitaminB12: 0.2,
  folate: 70,
};

/** The explicit "Save for reuse" action: totals + full breakdown. */
function saveTemplate(): Promise<SavedFood> {
  return addSavedFood("Dosa platter", mealTotals, breakdown);
}

describe("saved meals (S4)", () => {
  it("logging a meal does not create a saved meal", async () => {
    const logged = await addMeal(
      "Weeknight bowl",
      { calories: 520, protein: 18, carbs: 60, fat: 14 },
      breakdown,
    );

    expect(logged.foods).toEqual(breakdown);
    expect(await getSavedFoods()).toEqual([]);
    expect(await getTodayMeals()).toHaveLength(1);
  });

  it("explicitly saving a meal creates a reusable saved meal without logging it", async () => {
    const template = await saveTemplate();
    const saved = await getSavedFoods();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: template.id,
      name: "Dosa platter",
      foods: breakdown,
    });
    // Saving is not logging: the diary stays empty.
    expect(await getTodayMeals()).toEqual([]);
  });

  it("a saved meal preserves all 16 nutrients", async () => {
    await saveTemplate();
    const [stored] = await getSavedFoods();

    const estimate = savedFoodToEstimate(stored);

    expect(Object.keys(estimate.totals).sort()).toEqual(
      [...NUTRIENT_KEYS].sort(),
    );
    expect(estimate.totals).toEqual(mealTotals);
    // Per-food micros survive as well.
    expect(estimate.foods[0]).toMatchObject({
      fiber: 2,
      sodium: 380,
      folate: 15,
    });
  });

  it("a saved meal preserves the complete food breakdown", async () => {
    await saveTemplate();
    const [stored] = await getSavedFoods();

    const estimate = savedFoodToEstimate(stored);

    expect(estimate.foods).toHaveLength(2);
    // S6A: the editor no longer models per-food additionals — reopening
    // folds the legacy ghee additional's nutrition into the parent food
    // (every stored nutrient survives) and the nested list does not
    // reappear.
    expect(estimate.foods[0]).toMatchObject({
      name: "Masala dosa",
      estimatedAmount: 1,
      unit: "piece",
      calories: 385, // 250 dosa + 135 legacy ghee, folded
      protein: 4,
      carbs: 40,
      fat: 24, // 9 + 15
      fiber: 2,
      sodium: 380,
    });
    expect(estimate.foods[0]).not.toHaveProperty("additionals");
    expect(estimate.foods[1]).toMatchObject({
      name: "Sambar",
      estimatedAmount: 150,
      unit: "ml",
      calories: 170,
    });
  });

  it("selecting a saved meal logs it fully offline", async () => {
    const fetchSpy = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      await saveTemplate();
      const [stored] = await getSavedFoods();

      // Selection path reads stored values only — no AI, no food DB,
      // no network, no recalculation.
      const estimate = savedFoodToEstimate(stored);
      const input = mealInputFromEstimate(estimate);

      // The sheet rebuilds MealFoods from its rows (field-for-field the
      // same mapping); nutrition.tsx seeds the stored title. Legacy
      // additionals already folded into the estimate's foods (S6A), so
      // the logged copy is flat with identical nutrition.
      const loggedFoods: MealFood[] = estimate.foods.map((food) => ({
        name: food.name,
        amount: food.estimatedAmount,
        unit: food.unit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        ...pickMicronutrients(food),
      }));

      const logged = await addMeal(
        stored.name,
        {
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          ...pickMicronutrients(input),
        },
        loggedFoods,
      );

      const today = await getTodayMeals();

      expect(today).toHaveLength(1);
      expect(today[0]).toMatchObject({
        name: "Dosa platter",
        calories: mealTotals.calories,
        protein: mealTotals.protein,
        foods: loggedFoods,
      });
      expect(pickMicronutrients(today[0])).toEqual(
        pickMicronutrients(mealTotals),
      );
      expect(typeof logged.timestamp).toBe("string");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("editing a logged copy does not mutate the saved template", async () => {
    await saveTemplate();
    const [stored] = await getSavedFoods();

    const estimate = savedFoodToEstimate(stored);
    estimate.foods[0].calories = 999; // user edits the review copy
    estimate.foods.splice(1, 1); // …and removes a row

    const template = await getSavedFoods();
    expect(template[0].foods).toEqual(breakdown);
    expect(template[0].foods?.[0]?.calories).toBe(250);
  });

  it("existing individual saved foods keep working", async () => {
    await addSavedFood("Whey scoop", {
      calories: 120,
      protein: 24,
      carbs: 3,
      fat: 1,
    });

    const [food] = await getSavedFoods();

    // No breakdown → still an individual food, never a saved meal.
    expect(food.foods).toBeUndefined();

    // The Add Meal quick-log path (macros only) still logs it.
    const logged = await addMeal(food.name, {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    });
    expect(logged.calories).toBe(120);
    expect(logged.foods).toBeUndefined();

    await deleteSavedFood(food.id);
    expect(await getSavedFoods()).toEqual([]);
  });

  it("existing persisted entries remain readable alongside saved meals", async () => {
    // Raw pre-S4 shapes: totals-only food and a minimal legacy record.
    storageMock.__seed(SAVED_FOODS_KEY, [
      {
        id: "old-food",
        name: "Paneer tikka",
        calories: 280,
        protein: 18,
        carbs: 8,
        fat: 20,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "old-minimal",
        name: "Oats",
        createdAt: "2025-01-02T00:00:00.000Z",
      },
    ]);

    const seeded = await getSavedFoods();
    expect(seeded).toHaveLength(2);
    expect(seeded[0]).toMatchObject({
      name: "Paneer tikka",
      calories: 280,
    });
    expect(seeded[1].foods).toBeUndefined();

    // The saved-meal format is purely additive — both shapes coexist.
    await saveTemplate();
    const all = await getSavedFoods();
    expect(all).toHaveLength(3);
    expect(all[2].foods).toEqual(breakdown);
  });
});
