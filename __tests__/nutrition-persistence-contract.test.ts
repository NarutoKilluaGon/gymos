import {
  addMeal,
  getTodayMeals,
} from "@/storage/repositories/meals";
import {
  addSavedFood,
  getSavedFoods,
} from "@/storage/repositories/saved-foods";
import {
  computeMealTotals,
  canSaveReusableNutrition,
  hasCanonicalNutrition,
  mealInputFromEstimate,
  toCanonicalMealNutrition,
} from "@/services/meal-estimator";
import {
  foodEntryToEstimate,
  getFoodEntry,
} from "@/services/food-db";
import { NUTRIENT_KEYS } from "@/types/gymos";
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
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __reset(): void;
};

const fullNutrition = {
  calories: 420,
  protein: 30,
  carbs: 40,
  fat: 14,
  fiber: 8,
  sodium: 300,
  potassium: 500,
  calcium: 120,
  iron: 3,
  magnesium: 40,
  zinc: 2,
  vitaminA: 120,
  vitaminC: 15,
  vitaminD: 1,
  vitaminB12: 2,
  folate: 60,
};

function completeFood(overrides: Partial<MealFood> = {}): MealFood {
  return {
    name: "Custom food",
    amount: 1,
    unit: "serving",
    ...fullNutrition,
    ...overrides,
  };
}

function expectAllNutrition(
  value: Partial<Record<(typeof NUTRIENT_KEYS)[number], unknown>>,
) {
  for (const key of NUTRIENT_KEYS) {
    expect(typeof value[key]).toBe("number");
    expect(Number.isFinite(value[key])).toBe(true);
  }
}

beforeEach(() => {
  storageMock.__reset();
});

describe("canonical Nutrition persistence contract", () => {
  it("Food DB quick-log preserves all 16 nutrients and the catalog breakdown", async () => {
    const entry = getFoodEntry("ghee")!;
    const input = mealInputFromEstimate(foodEntryToEstimate(entry));
    const logged = await addMeal(
      input.name,
      toCanonicalMealNutrition(input),
      input.foods,
    );

    expectAllNutrition(logged);
    expect(logged.foods).toHaveLength(1);
    expect(logged.foods?.[0]).toMatchObject({
      entryId: "ghee",
      calories: 135,
      vitaminA: 100,
      vitaminD: 0.2,
    });
  });

  it("saved-food quick-log preserves stored nutrition without Food DB recalculation", async () => {
    const saved = await addSavedFood(
      "User branded snack",
      fullNutrition,
    );
    const input = {
      name: saved.name,
      calories: saved.calories,
      protein: saved.protein,
      carbs: saved.carbs,
      fat: saved.fat,
      fiber: saved.fiber,
      sodium: saved.sodium,
      potassium: saved.potassium,
      calcium: saved.calcium,
      iron: saved.iron,
      magnesium: saved.magnesium,
      zinc: saved.zinc,
      vitaminA: saved.vitaminA,
      vitaminC: saved.vitaminC,
      vitaminD: saved.vitaminD,
      vitaminB12: saved.vitaminB12,
      folate: saved.folate,
    };
    const logged = await addMeal(
      input.name,
      toCanonicalMealNutrition(input),
    );

    expectAllNutrition(logged);
    expect(logged).toMatchObject(fullNutrition);
    expect(logged.foods).toBeUndefined();
  });

  it("Home-style meal input preserves flat and per-food micronutrients", async () => {
    const food = completeFood({ name: "Home bowl food" });
    const input = {
      name: "Home meal",
      ...fullNutrition,
      foods: [food],
    };
    const logged = await addMeal(
      input.name,
      toCanonicalMealNutrition(input),
      input.foods,
    );

    expectAllNutrition(logged);
    expect(logged).toMatchObject(fullNutrition);
    expect(logged.foods?.[0]).toMatchObject({
      vitaminD: 1,
      folate: 60,
    });
  });

  it("quick-meal/resolved estimate keeps its complete food snapshot", () => {
    const estimate = foodEntryToEstimate(getFoodEntry("ghee")!);
    const input = mealInputFromEstimate(estimate);

    expectAllNutrition(input);
    expect(input.foods).toHaveLength(1);
    expect(input.foods?.[0]).toMatchObject({
      entryId: "ghee",
      vitaminA: 100,
      vitaminD: 0.2,
    });
  });

  it("keeps meal totals consistent with the supplied food breakdown", () => {
    const first = completeFood({
      name: "First",
      calories: 100,
      protein: 10,
      vitaminD: 0.2,
    });
    const second = completeFood({
      name: "Second",
      calories: 200,
      protein: 20,
      vitaminD: 0.4,
    });
    const foods = [first, second];
    const nutrition = toCanonicalMealNutrition({
      calories: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
      foods,
    });

    expect(nutrition).toEqual(computeMealTotals(foods));
    expect(nutrition.vitaminD).toBe(0.6);
  });

  it("saved reusable nutrition is complete and logging remains separate", async () => {
    const food = completeFood({ name: "Reusable bowl" });
    const nutrition = toCanonicalMealNutrition({
      ...fullNutrition,
      foods: [food],
    });
    const saved = await addSavedFood(
      "Reusable bowl",
      nutrition,
      [food],
    );
    const [logged] = await getTodayMeals();

    expect(saved).toMatchObject(fullNutrition);
    expect(saved.foods?.[0]).toMatchObject({
      vitaminD: 1,
      folate: 60,
    });
    expect(logged).toBeUndefined();

    const loggedMeal = await addMeal("Logged separately", nutrition, [food]);
    expect(loggedMeal).toMatchObject(fullNutrition);
    expect(await getSavedFoods()).toHaveLength(1);
    expect((await getTodayMeals()).map((meal) => meal.name)).toEqual([
      "Logged separately",
    ]);
  });

  it("does not treat an all-zero reusable record as complete", () => {
    expect(
      hasCanonicalNutrition({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).toBe(false);
    expect(
      hasCanonicalNutrition({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        vitaminD: 0.2,
      }),
    ).toBe(true);
    expect(
      canSaveReusableNutrition(
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        true,
      ),
    ).toBe(false);
  });

  it("loads historical meals without newer micronutrient fields safely", async () => {
    storageMock.__reset();
    await addMeal("Legacy meal", {
      calories: 250,
      protein: 20,
      carbs: 30,
      fat: 8,
    });

    const [meal] = await getTodayMeals();
    expect(meal).toMatchObject({
      calories: 250,
      protein: 20,
      carbs: 30,
      fat: 8,
    });
    expect(meal.fiber).toBeUndefined();
    expect(meal.vitaminD).toBeUndefined();
  });
});
