import type { EstimatedFood } from "@/components/quick-add/meal-sheet";
import {
  addMeal,
  getTodayMeals,
  updateMeal,
} from "@/storage/repositories/meals";
import {
  addSavedFood,
  getSavedFoods,
  isSavedMeal,
} from "@/storage/repositories/saved-foods";
import {
  canStartAnalysis,
  computeMealTotals,
  foodRowToMealFood,
  mealToEstimate,
  progressPercent,
  RESOLUTION_STAGES,
  rescaleFoodRow,
  resolveFoodForMeal,
  resolveMealDescription,
  resolveMealDescriptionStaged,
  resolveSegmentLocally,
  savedFoodToEstimate,
  splitDescriptionSegments,
  toFoodRow,
  type FoodRow,
  type ResolutionProgress,
} from "@/services/meal-estimator";
import * as estimator from "@/services/meal-estimator";
import { NUTRIENT_KEYS, pickMicronutrients } from "@/types/gymos";
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

/** Every canonical nutrient present and finite on a row/food. */
function expectAllNutrients(value: {
  [K in (typeof NUTRIENT_KEYS)[number]]?: unknown;
}): void {
  for (const key of NUTRIENT_KEYS) {
    const raw = value[key];
    expect(typeof raw === "number" && Number.isFinite(raw)).toBe(
      true,
    );
  }
}

/** Local resolution never touches the network: fail loudly if it tries. */
function throwingFetch(): typeof fetch {
  const spy = jest.fn(async (): Promise<never> => {
    throw new Error("network must not be used");
  });
  return spy as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  storageMock.__reset();
});

describe("offline nutrition resolution", () => {
  it("(A) resolves a description entirely offline through the Food DB", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = throwingFetch();
    const spy = globalThis.fetch as unknown as jest.Mock;

    try {
      const foods = resolveMealDescription("150g curd");

      expect(foods).toHaveLength(1);
      expect(foods[0]).toMatchObject({
        entryId: "curd",
        estimatedAmount: 150,
        unit: "g",
        // 200 g portion → 120 kcal scales to 150 g.
        calories: 90,
        protein: 5.25,
        carbs: 6.75,
        fat: 3,
      });
      expect(foods[0].unresolved).toBeUndefined();
      expectAllNutrients(foods[0]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("(B) parses multiple foods into separate rows", () => {
    const foods = resolveMealDescription(
      "10 eggs omelette with 200g cooked rice and 150g curd",
    );

    // One row per distinct food mention — never merged, never dropped.
    expect(foods).toHaveLength(3);
    expect(new Set(foods.map((food) => food.name)).size).toBe(3);

    // Confident matches resolve with catalog nutrition…
    const curd = foods.find((food) => food.entryId === "curd");
    expect(curd).toMatchObject({
      estimatedAmount: 150,
      unit: "g",
      calories: 90,
    });
    expect(curd?.unresolved).toBeUndefined();

    const rice = foods.find((food) => food.entryId === "cooked-rice");
    expect(rice).toMatchObject({
      estimatedAmount: 200,
      unit: "g",
      calories: 260, // 130 kcal per 100 g × 2
    });
    expect(rice?.unresolved).toBeUndefined();

    // …anything less confident is flagged for manual entry. A name
    // match with an inconvertible unit keeps the catalog link (the
    // review offers the entry's unit) with zero/"unknown" macros.
    const flagged = foods.filter((food) => food.unresolved === true);
    expect(flagged).toHaveLength(1);
    expect(flagged).toMatchObject([
      { name: "Omelette (2 eggs)", estimatedAmount: 10, unit: "eggs" },
    ]);
    expect(flagged[0].entryId).toBe("omelette");
  });

  it("(B) splits descriptions on punctuation and conjunctions", () => {
    expect(
      splitDescriptionSegments(
        "10 eggs omelette with 1.5 tablespoon ghee and 200 gm cooked rice. Half tomato. 150 gm mashed potato. 150 gm curd",
      ),
    ).toEqual([
      "10 eggs omelette",
      "1.5 tablespoon ghee",
      "200 gm cooked rice",
      "Half tomato",
      "150 gm mashed potato",
      "150 gm curd",
    ]);
    expect(splitDescriptionSegments("2 idli, 1 bowl sambar")).toEqual([
      "2 idli",
      "1 bowl sambar",
    ]);
    expect(
      splitDescriptionSegments("coriander chutney with curd"),
    ).toEqual(["coriander chutney", "curd"]);
    expect(splitDescriptionSegments("   ")).toEqual([]);
  });

  it("(C) scales Food DB nutrition correctly by quantity", () => {
    const ghee = resolveSegmentLocally("2 tbsp ghee");

    expect(ghee).toMatchObject({
      entryId: "ghee",
      estimatedAmount: 2,
      unit: "tbsp",
      calories: 270, // 135 kcal per tbsp × 2
      fat: 30, // 15 g per tbsp × 2
      vitaminA: 200, // micros scale with macros
      vitaminD: 0.4,
    });
    expectAllNutrients(ghee);

    const paneer = resolveSegmentLocally("150 g paneer");

    expect(paneer).toMatchObject({
      entryId: "paneer",
      estimatedAmount: 150,
      calories: 397.5, // 265 kcal per 100 g × 1.5
      protein: 27,
    });
    expectAllNutrients(paneer);
  });

  it("(D) unknown food receives no fake nutrition", () => {
    const food = resolveSegmentLocally("200g homemade paneer curry");

    // Not silently substituted with plain "Paneer".
    expect(food.entryId).toBeUndefined();
    expect(food).toMatchObject({
      name: "homemade paneer curry",
      estimatedAmount: 200,
      unit: "g",
      unresolved: true,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    // Zero means "unknown" — no micros are claimed either.
    expect(food.fiber).toBeUndefined();
    expect(food.vitaminA).toBeUndefined();

    const row = toFoodRow(food);
    expect(row.unresolved).toBe(true);

    const mealFood = foodRowToMealFood(row)!;
    expect(mealFood.calories).toBe(0);
    expect(mealFood.fiber).toBeUndefined();
  });

  it("(E) manual nutrition resolves an unknown food", () => {
    const row = toFoodRow(
      resolveSegmentLocally("200g homemade paneer curry"),
    );
    expect(row.unresolved).toBe(true);

    // The user types macros manually — the same fields every row has.
    const typed: FoodRow = {
      ...row,
      calories: "320",
      protein: "12",
      carbs: "40",
      fat: "14",
    };
    const mealFood = foodRowToMealFood(typed)!;

    expect(mealFood).toMatchObject({
      name: "homemade paneer curry",
      amount: 200,
      unit: "g",
      calories: 320,
      protein: 12,
      carbs: 40,
      fat: 14,
    });
    // The unresolved marker never persists — typed values are the record.
    expect("unresolved" in mealFood).toBe(false);
    expect(mealFood.fiber).toBeUndefined();
  });

  it("(F) saved manually-resolved food works offline with stored nutrition", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = throwingFetch();
    const spy = globalThis.fetch as unknown as jest.Mock;

    try {
      // Exactly what the sheet persists after manual entry.
      const manualFood: MealFood = {
        name: "Homemade paneer curry",
        amount: 200,
        unit: "g",
        calories: 320,
        protein: 12,
        carbs: 40,
        fat: 14,
      };
      const saved = await addSavedFood(
        "Homemade paneer curry",
        {
          calories: 320,
          protein: 12,
          carbs: 40,
          fat: 14,
        },
        [manualFood],
      );

      expect(await getSavedFoods()).toHaveLength(1);

      // Reopening reuses stored nutrition directly — no DB
      // re-estimation ("Paneer butter masala" is not substituted),
      // no network, no recalculation.
      const reopened = savedFoodToEstimate(saved);

      expect(reopened.foods).toHaveLength(1);
      expect(reopened.foods[0]).toMatchObject({
        name: "Homemade paneer curry",
        estimatedAmount: 200,
        unit: "g",
        calories: 320,
        protein: 12,
        carbs: 40,
        fat: 14,
      });
      expect(reopened.foods[0].entryId).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("(F) saved shortcuts still branch on the stored breakdown", () => {
    expect(
      isSavedMeal({
        id: "f1",
        name: "Whey scoop",
        calories: 120,
        protein: 24,
        carbs: 3,
        fat: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isSavedMeal({
        id: "m1",
        name: "Dosa platter",
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
      }),
    ).toBe(true);
  });

  it("(G) resolution is provider-free and network-free", () => {
    const runtime = estimator as Record<string, unknown>;

    // No provider, image, or pending machinery exists in the module.
    for (const absent of [
      "applyFoodDbNutrition",
      "createProxyVisionProvider",
      "setVisionProvider",
      "getVisionProvider",
      "OfflineAnalysisError",
      "applyHybridNutrition",
      "validateAiFood",
      "OFFLINE_RESOLVE_MESSAGE",
      "SERVICE_UNAVAILABLE_MESSAGE",
      "VisionProvider",
      "ProxyVisionProviderOptions",
      "DescriptionIntelligenceInput",
    ]) {
      expect(runtime[absent]).toBeUndefined();
    }

    // The local resolution API is fully present.
    for (const kept of [
      "resolveMealDescription",
      "resolveMealDescriptionStaged",
      "resolveSegmentLocally",
      "resolveFoodForMeal",
      "matchSavedFood",
      "recentFoodsFromMeals",
      "splitDescriptionSegments",
      "progressPercent",
      "RESOLUTION_STAGES",
      "computeMealTotals",
      "toFoodRow",
      "foodRowToMealFood",
      "rescaleFoodRow",
      "establishRowBase",
      "canStartAnalysis",
      "mealToEstimate",
      "savedFoodToEstimate",
      "mealInputFromEstimate",
      "searchQuickMeals",
    ]) {
      expect(runtime[kept]).toBeDefined();
    }

    // Pure local resolution never touches the network.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = throwingFetch();
    const spy = globalThis.fetch as unknown as jest.Mock;

    try {
      const result = resolveFoodForMeal({ description: "ghee" });
      expect(result.status).toBe("resolved");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("(H) photo analysis is no longer part of the Nutrition flow", () => {
    const foods = resolveMealDescription(
      "10 eggs omelette with 200g cooked rice and 150g curd",
    );

    // No photo/image keys anywhere in resolved rows.
    expect(JSON.stringify(foods)).not.toMatch(
      /photo|image|mime|base64|camera|scan/i,
    );

    for (const food of foods) {
      expect("photoUri" in food).toBe(false);
    }

    // The staged resolver emits no photo/image stages either.
    expect(
      RESOLUTION_STAGES.join(" ").toLowerCase(),
    ).not.toMatch(/photo|image|scan|camera/);
  });

  it("(I) processing progress reflects actual work completed", async () => {
    expect(progressPercent(3, 5)).toBe(60);
    expect(progressPercent(0, 5)).toBe(0);
    expect(progressPercent(5, 5)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(7, 5)).toBe(100);
    expect(progressPercent(-1, 5)).toBe(0);
    expect(progressPercent(Number.NaN, 5)).toBe(0);

    const updates: ResolutionProgress[] = [];
    const result = await resolveMealDescriptionStaged(
      "150g curd and 2 tbsp ghee",
      (update) => {
        updates.push(update);
      },
    );

    if (result.status !== "resolved") {
      throw new Error(`expected a resolution, got ${result.status}`);
    }

    expect(result.estimate.foods).toHaveLength(2);
    // Same rows as the synchronous resolver — progress never invents.
    expect(result.estimate.foods).toEqual(
      resolveMealDescription("150g curd and 2 tbsp ghee"),
    );

    // 2 segments → 4 work units (parse + 2 foods + totals).
    expect(updates.map((update) => update.label)).toEqual([
      RESOLUTION_STAGES[0],
      RESOLUTION_STAGES[1],
      RESOLUTION_STAGES[1],
      RESOLUTION_STAGES[2],
    ]);
    expect(updates.map((update) => update.current)).toEqual([
      1, 2, 3, 4,
    ]);
    for (const update of updates) {
      expect(update.total).toBe(4);
      expect(
        progressPercent(update.current, update.total),
      ).toBeGreaterThan(0);
    }
    // Monotonic: progress only advances as work completes.
    for (let index = 1; index < updates.length; index++) {
      expect(updates[index].current).toBeGreaterThan(
        updates[index - 1].current,
      );
    }
    expect(updates[1].detail).toBe("1 of 2");
    expect(updates[2].detail).toBe("2 of 2");
  });

  it("(I) staged resolution reports empty for blank input", async () => {
    const updates: ResolutionProgress[] = [];

    expect(
      await resolveMealDescriptionStaged("   ", (update) => {
        updates.push(update);
      }),
    ).toEqual({ status: "empty" });
    expect(updates).toEqual([]);
  });

  it("(J/K/L) totals follow add, amount-change, and remove automatically", () => {
    const total = (rows: FoodRow[]) =>
      computeMealTotals(
        rows
          .map(foodRowToMealFood)
          .filter((food): food is MealFood => food !== null),
      );

    const ghee = resolveFoodForMeal({ description: "ghee" });
    const paneer = resolveFoodForMeal({
      description: "paneer",
      amount: 150,
      unit: "g",
    });

    if (
      ghee.status !== "resolved" ||
      paneer.status !== "resolved"
    ) {
      throw new Error("expected both foods to resolve");
    }

    let rows: FoodRow[] = [...ghee.foods, ...paneer.foods].map(
      toFoodRow,
    );

    // (J) ghee @ 1 tbsp (135) + paneer @ 150 g (397.5).
    expect(total(rows)).toMatchObject({ calories: 532.5, fat: 45 });

    // (J) adding another food joins the sum automatically…
    const extra = resolveFoodForMeal({
      description: "ghee",
      amount: 1,
      unit: "tbsp",
    });

    if (extra.status !== "resolved") {
      throw new Error("expected the extra ghee to resolve");
    }

    rows = [...rows, ...extra.foods.map(toFoodRow)];
    expect(total(rows)).toMatchObject({ calories: 667.5 });

    // (K) …an amount edit on a catalog-linked row rescales at once…
    rows = rows.map((row, index) =>
      index === 0
        ? rescaleFoodRow({ ...row, amount: "2" })
        : row,
    );
    expect(total(rows)).toMatchObject({ calories: 802.5, fat: 75 });

    // (L) …and removing a food drops it immediately.
    rows = rows.filter((row) => row.entryId !== "paneer");
    expect(total(rows)).toMatchObject({
      calories: 405,
      fat: 45,
      vitaminA: 300,
    });
  });

  it("(M) carries all 16 nutrients through resolve → review → save → reload", async () => {
    const resolved = resolveFoodForMeal({
      description: "ghee",
      amount: 2,
      unit: "tbsp",
    });

    if (resolved.status !== "resolved") {
      throw new Error(
        `expected a resolution, got ${resolved.status}`,
      );
    }

    const row = toFoodRow(resolved.foods[0]);
    const mealFood = foodRowToMealFood(row)!;

    expect(Object.keys(mealFood)).toEqual(
      expect.arrayContaining(NUTRIENT_KEYS),
    );
    expect(mealFood).toMatchObject({
      entryId: "ghee",
      calories: 270,
      fat: 30,
      vitaminA: 200,
      vitaminD: 0.4,
    });
    expectAllNutrients(mealFood);

    // Persist exactly the way the review sheet's save path does:
    // totals derived from the rows, breakdown alongside.
    const totals = computeMealTotals([mealFood]);
    const logged = await addMeal(
      "Ghee (reviewed)",
      {
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        ...pickMicronutrients(totals),
      },
      [mealFood],
    );

    // Reload for editing…
    const [reloaded] = await getTodayMeals();
    expect(reloaded.id).toBe(logged.id);

    const reopened = mealToEstimate(reloaded);
    expect(reopened.foods).toHaveLength(1);
    expect(Object.keys(reopened.foods[0])).toEqual(
      expect.arrayContaining(NUTRIENT_KEYS),
    );
    expect(reopened.foods[0]).toMatchObject({
      entryId: "ghee",
      calories: 270,
      vitaminA: 200,
      vitaminD: 0.4,
    });

    // Edit round-trip: rows → MealFood → updateMeal → reload.
    const edited = foodRowToMealFood(
      toFoodRow(reopened.foods[0]),
    )!;
    expect(edited).toMatchObject({ entryId: "ghee", vitaminA: 200 });

    const updated = await updateMeal(
      logged.id,
      "Ghee (edited)",
      {
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        ...pickMicronutrients(totals),
      },
      [edited],
    );
    expect(updated).not.toBeNull();

    // After the edit the breakdown still carries every nutrient.
    const [afterEdit] = await getTodayMeals();
    const finalFood = afterEdit.foods![0];
    expect(Object.keys(finalFood)).toEqual(
      expect.arrayContaining(NUTRIENT_KEYS),
    );
    expect(finalFood).toMatchObject({
      entryId: "ghee",
      vitaminA: 200,
      vitaminD: 0.4,
      folate: 0,
    });
    expectAllNutrients(finalFood);
  });

  it("keeps legacy additionals readable while the active flow stays flat", () => {
    const resolved = resolveFoodForMeal({
      description: "ghee",
    });

    if (resolved.status !== "resolved") {
      throw new Error(
        `expected a resolution, got ${resolved.status}`,
      );
    }

    // Resolved rows never carry the removed concept…
    const row = toFoodRow(resolved.foods[0]);
    expect(row).not.toHaveProperty("additionals");

    const mealFood = foodRowToMealFood(row)!;
    expect(mealFood).not.toHaveProperty("additionals");

    // …and a pre-S6A meal reopens with its nutrition folded in place.
    const legacy: Meal = {
      id: "legacy-1",
      name: "Dosa platter",
      timestamp: "2025-06-01T08:00:00.000Z",
      calories: 385,
      protein: 4,
      carbs: 40,
      fat: 24,
      foods: [
        {
          name: "Masala dosa",
          amount: 1,
          unit: "piece",
          calories: 250,
          protein: 4,
          carbs: 40,
          fat: 9,
          additionals: [
            {
              id: "a1",
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
      ],
    };

    const estimate = mealToEstimate(legacy);
    expect(estimate.foods[0]).not.toHaveProperty("additionals");
    expect(estimate.foods[0]).toMatchObject({
      name: "Masala dosa",
      calories: 385, // 250 + 135, folded
      fat: 24, // 9 + 15, folded
    });

    // The totals path still counts legacy additionals (data compat).
    expect(computeMealTotals(legacy.foods!)).toMatchObject({
      calories: 385,
      fat: 24,
    });
  });

  it("blocks duplicate submissions while a resolve is in flight", () => {
    expect(canStartAnalysis(false, "150g curd")).toBe(true);
    // A second tap while the first resolve is running is blocked…
    expect(canStartAnalysis(true, "150g curd")).toBe(false);
    // …and blank input never starts one.
    expect(canStartAnalysis(false, "   ")).toBe(false);
    expect(canStartAnalysis(false, "")).toBe(false);
  });

  it("single-food resolution never substitutes or fabricates", () => {
    // Exact match resolves with catalog nutrition…
    const ghee = resolveFoodForMeal({
      description: "150 g paneer",
    });

    if (ghee.status !== "resolved") {
      throw new Error(`expected a resolution, got ${ghee.status}`);
    }

    expect(ghee.foods[0]).toMatchObject({
      entryId: "paneer",
      estimatedAmount: 150,
      calories: 397.5, // 265 kcal per 100 g × 1.5
    });
    expectAllNutrients(ghee.foods[0]);

    // …near-matches stay explicitly unresolved…
    const curry = resolveFoodForMeal({
      description: "200g homemade paneer curry",
    });

    if (curry.status !== "unresolved") {
      throw new Error(`expected unresolved, got ${curry.status}`);
    }

    expect(curry.foods).toHaveLength(1);
    expect(curry.foods[0].unresolved).toBe(true);
    expect(curry.foods[0].entryId).toBeUndefined();

    // …and blank input resolves to nothing.
    expect(
      resolveFoodForMeal({ description: "   " }),
    ).toEqual({ status: "none" });
  });
});
