import {
  addSavedFood,
  getSavedFoods,
} from "@/storage/repositories/saved-foods";
import {
  addMeal,
  getTodayMeals,
} from "@/storage/repositories/meals";
import {
  getNutritionTargets,
  saveNutritionTargets,
} from "@/storage/repositories/nutrition-targets";
import {
  computeMealTotals,
  establishRowBase,
  foodRowToMealFood,
  rescaleFoodRow,
  resolveFoodForMeal,
  resolveMealDescription,
  resolveMealDescriptionStaged,
  toFoodRow,
  type FoodRow,
  type ResolutionProgress,
} from "@/services/meal-estimator";
import { calculateCalorieTarget } from "@/services/calorie-target";
import * as estimator from "@/services/meal-estimator";
import { NUTRIENT_KEYS } from "@/types/gymos";
import type { MealFood } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";

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

/** Full-16 local food: 250 g paneer curry values for scaling tests. */
const curryNutrients = {
  calories: 325,
  protein: 14,
  carbs: 18,
  fat: 22,
  fiber: 3,
  sodium: 500,
  potassium: 400,
  calcium: 250,
  iron: 2,
  magnesium: 40,
  zinc: 1.2,
  vitaminA: 200,
  vitaminC: 5,
  vitaminD: 0.1,
  vitaminB12: 0.4,
  folate: 30,
};

function curryFood() {
  return {
    name: "Paneer curry",
    estimatedAmount: 250,
    unit: "g",
    ...curryNutrients,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  storageMock.__reset();
});

describe("local nutrition resolution", () => {
  it("resolves '10 eggs + 200g cooked rice + 150g curd' locally", () => {
    const foods = resolveMealDescription(
      "10 eggs + 200g cooked rice + 150g curd",
    );

    expect(foods).toHaveLength(3);

    // "10 eggs" → boiled-egg alias, scaled ×10 from the 1-piece portion.
    expect(foods[0]).toMatchObject({
      name: "Boiled egg",
      entryId: "boiled-egg",
      estimatedAmount: 10,
      calories: 700,
      protein: 60,
      carbs: 10,
      fat: 50,
    });
    expect(foods[0].unresolved).toBeUndefined();

    // "200g cooked rice" → exact 100 g entry, scaled ×2.
    expect(foods[1]).toMatchObject({
      entryId: "cooked-rice",
      estimatedAmount: 200,
      unit: "g",
      calories: 260,
      protein: 5.4,
      carbs: 56,
      fat: 0.6,
    });

    // "150g curd" → 200 g entry scaled ×0.75.
    expect(foods[2]).toMatchObject({
      entryId: "curd",
      estimatedAmount: 150,
      calories: 90,
    });

    const totals = computeMealTotals(foods);
    expect(totals.calories).toBe(700 + 260 + 90);
  });

  it("resolves known foods and flags ambiguous ones in '2 eggs + 1 cup rice'", () => {
    const foods = resolveMealDescription("2 eggs + 1 cup rice");

    expect(foods).toHaveLength(2);

    // Confident match: boiled eggs ×2.
    expect(foods[0]).toMatchObject({
      entryId: "boiled-egg",
      estimatedAmount: 2,
      calories: 140,
    });
    expect(foods[0].unresolved).toBeUndefined();

    // Bare "rice" matches no entry confidently — manual row, no numbers.
    expect(foods[1]).toMatchObject({
      name: "rice",
      estimatedAmount: 1,
      unit: "cup",
      unresolved: true,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(foods[1].entryId).toBeUndefined();
    expect(foods[1].fiber).toBeUndefined();
  });

  it("staged resolution reports determinate local progress", async () => {
    const updates: ResolutionProgress[] = [];

    const result = await resolveMealDescriptionStaged(
      "150g curd and 2 idli",
      (update) => {
        updates.push(update);
      },
    );

    if (result.status !== "resolved") {
      throw new Error(`expected a resolution, got ${result.status}`);
    }

    expect(result.estimate.foods).toMatchObject([
      { entryId: "curd", estimatedAmount: 150, calories: 90 },
      { entryId: "idli", estimatedAmount: 2, calories: 140 },
    ]);
    expect(result.estimate.totals.calories).toBe(230);
    // 2 segments → 4 work units (parse + 2 foods + totals).
    expect(updates.map((update) => update.current)).toEqual([
      1, 2, 3, 4,
    ]);
    for (let index = 1; index < updates.length; index++) {
      expect(updates[index].current).toBeGreaterThan(
        updates[index - 1].current,
      );
    }
  });

  it("quantity scaling doubles, halves, and scales arbitrarily", () => {
    const row = toFoodRow(curryFood());
    expect(row.baseAmount).toBe(250);

    // Doubling doubles every macro.
    const doubled = rescaleFoodRow({ ...row, amount: "500" });
    expect(doubled).toMatchObject({
      calories: "650",
      protein: "28",
      carbs: "36",
      fat: "44",
    });

    // Halving halves.
    const halved = rescaleFoodRow({ ...row, amount: "125" });
    expect(halved).toMatchObject({
      calories: "162.5",
      protein: "7",
      fat: "11",
    });

    // Arbitrary quantities scale from the stable base (0.4×).
    const scaled = rescaleFoodRow({ ...row, amount: "100" });
    expect(scaled).toMatchObject({
      calories: "130",
      protein: "5.6",
      fat: "8.8",
    });
  });

  it("scales all 16 nutrients from the stable base", () => {
    const row = toFoodRow(curryFood());
    const scaled = rescaleFoodRow({ ...row, amount: "500" });
    const mealFood = foodRowToMealFood(scaled)!;

    for (const key of NUTRIENT_KEYS) {
      const base = (curryNutrients as Record<string, number>)[key];
      expect(mealFood[key]).toBe(base * 2);
    }
  });

  it("never compounds already-scaled values", () => {
    const row = toFoodRow(curryFood());

    const up = rescaleFoodRow({ ...row, amount: "500" });
    expect(up.calories).toBe("650");

    // Scaling back uses the original base, not the doubled display.
    const back = rescaleFoodRow({ ...up, amount: "250" });
    expect(back).toMatchObject({
      calories: "325",
      protein: "14",
      carbs: "18",
      fat: "22",
    });
  });

  it("establishes a scaling base from manual entry", () => {
    const unresolved = toFoodRow({
      name: "Dal",
      estimatedAmount: 150,
      unit: "g",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      unresolved: true,
    });

    // Catalog rows never take a manual base — the DB portion rules.
    const catalog = toFoodRow({
      name: "Ghee",
      estimatedAmount: 1,
      unit: "tbsp",
      calories: 135,
      protein: 0,
      carbs: 0,
      fat: 15,
      entryId: "ghee",
    });
    expect(establishRowBase(catalog)).toBe(catalog);

    // Typing macros with a positive amount establishes the base…
    const typed: FoodRow = {
      ...unresolved,
      calories: "170",
      protein: "9",
      carbs:  "24",
      fat: "5",
    };
    const based = establishRowBase(typed);
    expect(based.baseAmount).toBe(150);

    // …so a later quantity edit rescales the entered values.
    const rescaled = rescaleFoodRow({ ...based, amount: "300" });
    expect(rescaled).toMatchObject({
      calories: "340",
      protein: "18",
    });

    // Blank amount establishes nothing — typed values simply stay.
    const bare: FoodRow = { ...typed, amount: "" };
    delete bare.baseAmount;
    delete bare.baseNutrition;
    const kept = establishRowBase(bare);
    expect(kept.baseAmount).toBeUndefined();
    expect(kept).toMatchObject({ calories: "170", amount: "" });
  });

  it("removing food and editing quantity update totals instantly and synchronously", () => {
    const total = (rows: FoodRow[]) =>
      computeMealTotals(
        rows
          .map(foodRowToMealFood)
          .filter((food): food is MealFood => food !== null),
      );

    const ghee = resolveFoodForMeal({ description: "ghee" });

    if (ghee.status !== "resolved") {
      throw new Error("expected ghee to resolve");
    }

    const curryRow = toFoodRow(curryFood());
    let rows: FoodRow[] = [...ghee.foods.map(toFoodRow), curryRow];

    // 135 (ghee) + 325 (curry).
    expect(total(rows)).toMatchObject({ calories: 460 });

    // Quantity edit rescales immediately — sync, no timers.
    const edited = rescaleFoodRow({ ...curryRow, amount: "500" });
    expect(edited).not.toBeInstanceOf(Promise);

    rows = [rows[0], edited];
    expect(total(rows)).toMatchObject({ calories: 135 + 650 });

    // Removing a row drops it immediately — sync, no timers.
    rows = rows.filter((row) => row.key !== edited.key);
    const afterRemove = total(rows);
    expect(afterRemove).not.toBeInstanceOf(Promise);
    expect(afterRemove).toMatchObject({ calories: 135 });
  });

  it("saved foods reopen offline with stored values", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (): Promise<never> => {
      throw new Error("network must not be used");
    }) as unknown as typeof fetch;

    try {
      const manualFood: MealFood = {
        name: "Paneer curry",
        amount: 250,
        unit: "g",
        ...curryNutrients,
      };
      await addSavedFood("Paneer curry", { ...curryNutrients }, [
        manualFood,
      ]);
      expect(await getSavedFoods()).toHaveLength(1);

      const logged = await addMeal(
        "Paneer curry",
        { ...curryNutrients },
        [manualFood],
      );
      const [reloaded] = await getTodayMeals();
      expect(reloaded.id).toBe(logged.id);
      expect(reloaded.foods![0]).toMatchObject({
        calories: 325,
        protein: 14,
      });
      expect(
        (globalThis.fetch as unknown as jest.Mock).mock.calls,
      ).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("nutrition targets stay connected to the S7 engine", async () => {
    await saveNutritionTargets({
      maintenanceCalories: 2200,
      calorieGoal: "deficit",
      goalAdjustmentKcal: 300,
    });

    const targets = await getNutritionTargets();
    // Local calendar day (mirrors getTodayKey) so the activity item
    // lands on "today" in any timezone.
    const todayKey = getTodayKey();

    const result = calculateCalorieTarget({
      maintenanceCalories: targets.maintenanceCalories,
      goal: targets.calorieGoal,
      goalAdjustmentKcal: targets.goalAdjustmentKcal,
      timelineItems: [
        {
          kind: "cardio",
          id: "c1",
          timestamp: `${todayKey}T12:00:00`,
          activity: "running",
          durationMin: 30,
          calories: 200,
        },
      ],
      todayKey,
    });

    expect(result.hasMaintenance).toBe(true);
    // 2200 base + 200 training − 300 goal.
    expect(result.targetKcal).toBe(2100);
    expect(result.activityKcal).toBe(200);
  });

  it("no image, provider, or network code remains anywhere in the flow", async () => {
    const result = await resolveMealDescriptionStaged(
      "250g homemade paneer curry",
    );

    if (result.status !== "resolved") {
      throw new Error(`expected a resolution, got ${result.status}`);
    }

    const runtime = estimator as Record<string, unknown>;

    for (const absent of [
      "estimateMealFromPhoto",
      "pickMealPhoto",
      "inferImageMimeType",
      "photoUri",
      "createProxyVisionProvider",
      "setVisionProvider",
      "getVisionProvider",
      "VisionProvider",
      "ProxyVisionProviderOptions",
      "DescriptionIntelligenceInput",
      "OfflineAnalysisError",
      "applyHybridNutrition",
      "validateAiFood",
      "OFFLINE_RESOLVE_MESSAGE",
      "SERVICE_UNAVAILABLE_MESSAGE",
      "savePendingAnalysis",
      "getPendingAnalyses",
      "deletePendingAnalysis",
      "OFFLINE_PENDING_MESSAGE",
    ]) {
      expect(runtime[absent]).toBeUndefined();
    }

    expect(
      JSON.stringify(result.estimate.foods),
    ).not.toMatch(/photo|image|mime|base64|camera|vision/i);
    expect("photoUri" in result.estimate.foods[0]).toBe(false);
  });

  it("no pending-analysis system returns", () => {
    // Unknown foods resolve to manual rows — the "pending" status that
    // used to park them is gone from the result type entirely.
    const result = resolveFoodForMeal({
      description: "mystery stew",
    });

    expect(result.status).toBe("unresolved");
    expect("pending" in result).toBe(false);
  });

  it("no Nutrition operation uses fake loading", async () => {
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");

    try {
      // The staged resolver's default yield is a microtask: zero timers,
      // zero artificial delays — progress maps to completed work only.
      const updates: ResolutionProgress[] = [];
      const result = await resolveMealDescriptionStaged(
        "150g curd and 2 tbsp ghee",
        (update) => {
          updates.push(update);
        },
      );

      expect(result.status).toBe("resolved");
      expect(updates.length).toBeGreaterThan(0);
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      // Pure local operations are synchronous values, never promises.
      expect(
        resolveFoodForMeal({ description: "ghee" }),
      ).not.toBeInstanceOf(Promise);
      expect(
        computeMealTotals([
          {
            name: "Ghee",
            calories: 135,
            protein: 0,
            carbs: 0,
            fat: 15,
          },
        ]),
      ).not.toBeInstanceOf(Promise);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
