import {
  addSavedFood,
  getSavedFoods,
} from "@/storage/repositories/saved-foods";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import {
  getNutritionTargets,
  saveNutritionTargets,
} from "@/storage/repositories/nutrition-targets";
import {
  establishRowBase,
  foodRowToMealFood,
  matchSavedFood,
  recentFoodsFromMeals,
  rescaleFoodRow,
  resolveFoodForMeal,
  resolveMealDescription,
  resolveMealDescriptionStaged,
  resolveSegmentLocally,
  toFoodRow,
  computeMealTotals,
  type FoodRow,
  type ResolutionProgress,
} from "@/services/meal-estimator";
import { NUTRIENT_KEYS } from "@/types/gymos";
import type { Meal, MealFood } from "@/types/gymos";

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

const savedWhey: SavedFood = {
  id: "s1",
  name: "Whey",
  calories: 120,
  protein: 24,
  carbs: 3,
  fat: 1,
  fiber: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
};

const savedMeal: SavedFood = {
  id: "m1",
  name: "Dosa platter",
  calories: 420,
  protein: 10,
  carbs: 68,
  fat: 13,
  createdAt: "2025-01-02T00:00:00.000Z",
  foods: [
    {
      name: "Masala dosa",
      amount: 1,
      unit: "piece",
      calories: 250,
      protein: 4,
      carbs: 40,
      fat: 9,
    },
  ],
};

function meal(
  id: string,
  timestamp: string,
  foods?: MealFood[],
  name = `Meal ${id}`,
): Meal {
  return {
    id,
    name,
    timestamp,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...(foods ? { foods } : {}),
  };
}

function food(
  name: string,
  overrides: Partial<MealFood> = {},
): MealFood {
  return {
    name,
    amount: 1,
    unit: "piece",
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  storageMock.__reset();
});

describe("UX V2: saved-food resolution priority", () => {
  it("matches saved foods exactly, case- and plural-insensitively", () => {
    expect(matchSavedFood("Whey", [savedWhey])).toBe(savedWhey);
    expect(matchSavedFood("  whey  ", [savedWhey])).toBe(savedWhey);
    expect(matchSavedFood("wheys", [savedWhey])).toBe(savedWhey);
  });

  it("never matches saved meals, nutrition-less entries, or garbage", () => {
    expect(matchSavedFood("Dosa platter", [savedMeal])).toBeUndefined();
    expect(
      matchSavedFood("Whey", [
        { ...savedWhey, calories: undefined },
      ]),
    ).toBeUndefined();
    expect(matchSavedFood("whey protein", [savedWhey])).toBeUndefined();
    expect(matchSavedFood("", [savedWhey])).toBeUndefined();
    expect(matchSavedFood("Whey", null)).toBeUndefined();
    expect(matchSavedFood("Whey", [null] as unknown as SavedFood[])).toBeUndefined();
  });

  it("resolves segments from saved foods after the Food DB", () => {
    // DB still wins when both could serve.
    const dbWins = resolveSegmentLocally("ghee", [
      { ...savedWhey, name: "Ghee", calories: 1 },
    ]);
    expect(dbWins.entryId).toBe("ghee");
    expect(dbWins.calories).toBe(135);

    // Saved numbers apply as-is with the parsed portion labels.
    const saved = resolveSegmentLocally("2 scoops whey", [savedWhey]);
    expect(saved).toMatchObject({
      name: "Whey",
      estimatedAmount: 2,
      unit: "scoops",
      calories: 120,
      protein: 24,
    });
    expect(saved.entryId).toBeUndefined();
    expect(saved.unresolved).toBeUndefined();
  });

  it("single-add resolution consults saved foods before giving up", () => {
    const result = resolveFoodForMeal(
      { description: "whey" },
      [savedWhey],
    );

    if (result.status !== "resolved") {
      throw new Error(`expected a resolution, got ${result.status}`);
    }

    expect(result.foods[0]).toMatchObject({
      name: "Whey",
      calories: 120,
      protein: 24,
    });
  });

  it("saved-food match wins over an unresolved row for the same name", () => {
    // A segment matching a saved food resolves with stored numbers —
    // no catalog entry needed, no estimation, no network.
    const saved = resolveSegmentLocally("whey", [savedWhey]);

    expect(saved).toMatchObject({
      name: "Whey",
      calories: 120,
      protein: 24,
    });
    expect(saved.entryId).toBeUndefined();
    expect(saved.unresolved).toBeUndefined();

    // Unknown names still resolve to manual rows, never estimates.
    const unknown = resolveSegmentLocally("mystery stew", [savedWhey]);

    expect(unknown).toMatchObject({ unresolved: true });
    expect(unknown.entryId).toBeUndefined();
  });

  it("staged resolution completes the plate from saved foods alone", async () => {
    const updates: ResolutionProgress[] = [];

    const result = await resolveMealDescriptionStaged(
      "150g curd and whey",
      (update) => {
        updates.push(update);
      },
      undefined,
      [savedWhey],
    );

    if (result.status !== "resolved") {
      throw new Error(`expected a resolution, got ${result.status}`);
    }

    expect(result.estimate.foods).toMatchObject([
      { entryId: "curd" },
      { name: "Whey", calories: 120 },
    ]);
    expect(updates.map((update) => update.current)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("saved-then-logged foods reopen offline with stored values", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (): Promise<never> => {
      throw new Error("network must not be used");
    }) as unknown as typeof fetch;

    try {
      await addSavedFood(
        "Whey",
        { calories: 120, protein: 24, carbs: 3, fat: 1 },
        undefined,
      );
      const stored = await getSavedFoods();

      const foods = resolveMealDescription("whey", stored);
      expect(foods).toHaveLength(1);
      expect(foods[0]).toMatchObject({
        name: "Whey",
        calories: 120,
        protein: 24,
      });
      expect(
        (globalThis.fetch as unknown as jest.Mock).mock.calls,
      ).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("UX V2: incompatible units stay safe", () => {
  it("name match with a bad unit keeps the catalog link and zero macros", () => {
    const result = resolveFoodForMeal({
      description: "200 cups ghee",
    });

    if (result.status !== "unresolved") {
      throw new Error(`expected unresolved, got ${result.status}`);
    }

    // The row names the catalog match (visible, not silent) and keeps
    // the link so the review can offer the entry's unit — with unknown
    // (zero) macros, never scaled across units.
    expect(result.foods[0]).toMatchObject({
      name: "Ghee",
      estimatedAmount: 200,
      unit: "cups",
      entryId: "ghee",
      unresolved: true,
      calories: 0,
    });
  });

  it("adopting the suggested unit rescales safely from the portion", () => {
    const unresolved = resolveFoodForMeal({
      description: "200 cups ghee",
    });

    if (unresolved.status !== "unresolved") {
      throw new Error("expected unresolved");
    }

    const row = toFoodRow(unresolved.foods[0]);
    expect(row.entryId).toBe("ghee");

    // The only safe adoption: reset to the catalog portion, then scale.
    // The stale 200 (grams-thinking) is never reinterpreted as cups.
    const adopted = rescaleFoodRow({
      ...row,
      amount: "1",
      unit: "tbsp",
      unresolved: false,
    });

    expect(adopted).toMatchObject({
      calories: "135",
      protein: "0",
      carbs: "0",
      fat: "15",
    });
  });

  it("arbitrary unit edits never reinterpret stale amounts", () => {
    const row = toFoodRow({
      name: "Ghee",
      estimatedAmount: 1,
      unit: "tbsp",
      calories: 135,
      protein: 0,
      carbs: 0,
      fat: 15,
      entryId: "ghee",
    });

    // Incompatible unit: values freeze exactly as typed.
    const frozen = rescaleFoodRow({ ...row, unit: "cups" });
    expect(frozen).toMatchObject({
      calories: "135",
      fat: "15",
      unit: "cups",
    });
  });
});

describe("UX V2: micronutrient editing and stable scaling", () => {
  it("persists hand-edited micros through the row round-trip", () => {
    const row: FoodRow = {
      ...toFoodRow({
        name: "Dal",
        estimatedAmount: 150,
        unit: "g",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        unresolved: true,
      }),
      calories: "170",
      protein: "9",
      carbs: "24",
      fat: "5",
      micros: { fiber: 5, vitaminC: 30 },
    };

    const mealFood = foodRowToMealFood(row)!;
    expect(mealFood).toMatchObject({
      fiber: 5,
      vitaminC: 30,
    });

    // The base snapshot absorbs edited micros for later scaling.
    const based = establishRowBase(row);
    expect(based.baseNutrition).toMatchObject({
      calories: 170,
      fiber: 5,
      vitaminC: 30,
    });

    const doubled = rescaleFoodRow({ ...based, amount: "300" });
    const scaled = foodRowToMealFood(doubled)!;
    expect(scaled).toMatchObject({
      calories: 340,
      fiber: 10,
      vitaminC: 60,
    });
  });

  it("scales 100 → 200 → 250 from the stable base without compounding", () => {
    const row = toFoodRow({
      name: "Cooked rice",
      estimatedAmount: 100,
      unit: "g",
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
    });

    const at200 = rescaleFoodRow({ ...row, amount: "200" });
    expect(at200).toMatchObject({ calories: "260" });

    // From the 200 g display back to 250 g: still 2.5× the base, not
    // 260 × 250/200 compounded (identical here, but the base path —
    // not the displayed value — is what guarantees it).
    const at250 = rescaleFoodRow({ ...at200, amount: "250" });
    expect(at250).toMatchObject({
      calories: "325",
      protein: "6.75",
      carbs: "70",
      fat: "0.75",
    });

    const mealFood = foodRowToMealFood(at250)!;
    expect(mealFood.calories).toBe(325);
    expect(mealFood.protein).toBe(6.75);
  });

  it("scales all 16 nutrients from a manual base", () => {
    const base: FoodRow = {
      ...toFoodRow({
        name: "Dal",
        estimatedAmount: 150,
        unit: "g",
        calories: 170,
        protein: 9,
        carbs: 24,
        fat: 5,
        fiber: 4,
        sodium: 300,
        potassium: 350,
        calcium: 30,
        iron: 2,
        magnesium: 35,
        zinc: 0.6,
        vitaminA: 40,
        vitaminC: 4,
        vitaminD: 0,
        vitaminB12: 0.2,
        folate: 60,
        unresolved: true,
      }),
      calories: "170",
      protein: "9",
      carbs: "24",
      fat: "5",
    };
    const withBase = establishRowBase(base);
    const scaled = foodRowToMealFood(
      rescaleFoodRow({ ...withBase, amount: "300" }),
    )!;

    const expected: Record<string, number> = {
      calories: 340,
      protein: 18,
      carbs: 48,
      fat: 10,
      fiber: 8,
      sodium: 600,
      potassium: 700,
      calcium: 60,
      iron: 4,
      magnesium: 70,
      zinc: 1.2,
      vitaminA: 80,
      vitaminC: 8,
      vitaminD: 0,
      vitaminB12: 0.4,
      folate: 120,
    };

    for (const key of NUTRIENT_KEYS) {
      expect(scaled[key]).toBe(expected[key]);
    }
  });
});

describe("UX V2: recent foods", () => {
  it("derives latest-first deduped foods from logged meals", () => {
    const meals = [
      meal("old", "2025-01-01T08:00:00", [
        food("Curd", { calories: 90 }),
        food("Rice", { calories: 200 }),
      ]),
      meal("new", "2025-01-02T08:00:00", [
        food("Curd", { calories: 95 }),
        food("Eggs", { calories: 700 }),
      ]),
    ];

    const recents = recentFoodsFromMeals(meals);

    // Latest first; the newest Curd reference wins the dedupe.
    expect(recents.map((item) => item.name)).toEqual([
      "Curd",
      "Eggs",
      "Rice",
    ]);
    expect(recents[0].calories).toBe(95);
  });

  it("keeps the rescaling reference on recent foods", () => {
    const recents = recentFoodsFromMeals([
      meal("m1", "2025-01-02T08:00:00", [
        food("Ghee", { entryId: "ghee", amount: 1, unit: "tbsp" }),
      ]),
    ]);

    expect(recents).toHaveLength(1);
    expect(recents[0].entryId).toBe("ghee");
  });

  it("caps the list and tolerates malformed input", () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      meal(`m${index}`, "2025-01-02T08:00:00", [
        food(`Food ${index}`),
      ]),
    );

    expect(recentFoodsFromMeals(many)).toHaveLength(6);
    expect(recentFoodsFromMeals(many, 3)).toHaveLength(3);
    expect(recentFoodsFromMeals([])).toEqual([]);
    expect(recentFoodsFromMeals(null)).toEqual([]);
    expect(recentFoodsFromMeals(undefined)).toEqual([]);
    expect(
      recentFoodsFromMeals([
        meal("t", "2025-01-02T08:00:00"),
        null,
        undefined,
        42,
      ] as unknown as Meal[]),
    ).toEqual([]);
  });
});

describe("UX V2: configurable adjustment", () => {
  it("round-trips the adjustment through the targets repository", async () => {
    await saveNutritionTargets({
      maintenanceCalories: 2700,
      calorieGoal: "deficit",
      goalAdjustmentKcal: 500,
    });

    await expect(getNutritionTargets()).resolves.toMatchObject({
      maintenanceCalories: 2700,
      calorieGoal: "deficit",
      goalAdjustmentKcal: 500,
    });
  });
});
