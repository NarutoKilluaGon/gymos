import {
  addMeal,
  deleteMeal,
  getDailyMacroTotals,
  getTodayMeals,
  updateMeal,
} from "@/storage/repositories/meals";
import {
  computeMealTotals,
  foodRowToMealFood,
  mealInputFromEstimate,
  mealToEstimate,
  rescaleFoodRow,
  resolveFoodForMeal,
  resolveMealDescription,
  toFoodRow,
  type FoodRow,
} from "@/services/meal-estimator";
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

beforeEach(() => {
  storageMock.__reset();
});

/** Total a list of review rows exactly the way MealSheet derives it. */
function totalRows(rows: FoodRow[]) {
  return computeMealTotals(
    rows
      .map(foodRowToMealFood)
      .filter((food): food is MealFood => food !== null),
  );
}

describe("meal flow: describe → review → log → edit", () => {
  it("resolves '10 eggs + 200g cooked rice + 150g curd' with auto-populated nutrition", () => {
    const foods = resolveMealDescription(
      "10 eggs + 200g cooked rice + 150g curd",
    );

    expect(foods).toHaveLength(3);

    // Egg → Food DB (boiled-egg alias), scaled ×10 from 1 piece.
    expect(foods[0]).toMatchObject({
      entryId: "boiled-egg",
      estimatedAmount: 10,
      calories: 700,
      protein: 60,
    });
    // Cooked rice → Food DB, scaled ×2 from 100 g.
    expect(foods[1]).toMatchObject({
      entryId: "cooked-rice",
      estimatedAmount: 200,
      unit: "g",
      calories: 260,
      protein: 5.4,
      carbs: 56,
    });
    // Curd → Food DB, scaled ×0.75 from 200 g.
    expect(foods[2]).toMatchObject({
      entryId: "curd",
      estimatedAmount: 150,
      calories: 90,
    });

    for (const food of foods) {
      expect(food.unresolved).toBeUndefined();
    }

    const totals = computeMealTotals(foods);
    expect(totals.calories).toBe(700 + 260 + 90);
  });

  it("resolves '2 eggs' and leaves bare '1 cup rice' unresolved", () => {
    const foods = resolveMealDescription("2 eggs + 1 cup rice");

    expect(foods).toHaveLength(2);
    expect(foods[0]).toMatchObject({
      entryId: "boiled-egg",
      estimatedAmount: 2,
      calories: 140,
    });

    // No catalog entry is confidently "rice" in cups — manual row with
    // the stated portion, zero macros, no fabricated micros.
    expect(foods[1]).toMatchObject({
      name: "rice",
      estimatedAmount: 1,
      unit: "cup",
      unresolved: true,
      calories: 0,
    });
    expect(foods[1].entryId).toBeUndefined();
    expect(foods[1].fiber).toBeUndefined();
  });

  it("resolves 'a banana' as a single portion", () => {
    const foods = resolveMealDescription("a banana");

    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({
      entryId: "banana",
      estimatedAmount: 1,
      unit: "piece",
      calories: 105,
    });
  });

  it("leaves truly unknown food unresolved without fabricating", () => {
    const foods = resolveMealDescription("dragon fruit protein bar XYZ");

    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({
      unresolved: true,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(foods[0].entryId).toBeUndefined();
  });

  it("derives the meal name from all foods, never just the first word", () => {
    const foods = resolveMealDescription(
      "10 eggs + 200g cooked rice + 150g curd",
    );
    const input = mealInputFromEstimate({
      foods,
      totals: computeMealTotals(foods),
    });

    expect(input.name).toBe("Boiled egg, Cooked rice, Curd");
  });

  it("(L) adding a second food updates totals immediately", () => {
    const eggs = resolveFoodForMeal({ description: "2 eggs" });
    if (eggs.status !== "resolved") throw new Error("eggs must resolve");

    let rows = eggs.foods.map(toFoodRow);
    expect(totalRows(rows).calories).toBe(140);

    const rice = resolveFoodForMeal({
      description: "200g cooked rice",
    });
    if (rice.status !== "resolved") throw new Error("rice must resolve");

    rows = [...rows, ...rice.foods.map(toFoodRow)];
    expect(totalRows(rows).calories).toBe(140 + 260);

    const curd = resolveFoodForMeal({
      description: "150g curd",
      amount: undefined,
      unit: undefined,
    });
    if (curd.status !== "resolved") throw new Error("curd must resolve");

    rows = [...rows, ...curd.foods.map(toFoodRow)];
    expect(totalRows(rows).calories).toBe(140 + 260 + 90);
  });

  it("(M) removing a food updates totals immediately", () => {
    const eggs = resolveFoodForMeal({ description: "2 eggs" });
    const rice = resolveFoodForMeal({ description: "200g cooked rice" });
    if (eggs.status !== "resolved" || rice.status !== "resolved") {
      throw new Error("both must resolve");
    }

    const rows = [
      ...eggs.foods.map(toFoodRow),
      ...rice.foods.map(toFoodRow),
    ];
    expect(totalRows(rows).calories).toBe(140 + 260);

    const withoutRice = rows.filter(
      (row) => row.entryId !== "cooked-rice",
    );
    expect(totalRows(withoutRice).calories).toBe(140);
  });

  it("editing quantity updates totals immediately", () => {
    const rice = resolveFoodForMeal({ description: "200g cooked rice" });
    if (rice.status !== "resolved") throw new Error("must resolve");

    const [row] = rice.foods.map(toFoodRow);
    expect(totalRows([row]).calories).toBe(260);

    const edited = rescaleFoodRow({ ...row, amount: "100" });
    expect(totalRows([edited]).calories).toBe(130);
  });

  it("(R) micronutrients survive resolve → scale → persist → reload → edit", async () => {
    // Ghee carries non-zero vitaminA/vitaminD — a sharp end-to-end pin.
    const resolved = resolveFoodForMeal({
      description: "ghee",
      amount: 2,
      unit: "tbsp",
    });
    if (resolved.status !== "resolved") {
      throw new Error("ghee must resolve");
    }
    expect(resolved.foods[0].vitaminA).toBe(200);

    const totals = computeMealTotals(resolved.foods);
    expect(totals.vitaminA).toBe(200);
    expect(totals.vitaminD).toBe(0.4);

    const logged = await addMeal(
      "Ghee",
      {
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        sodium: totals.sodium,
        potassium: totals.potassium,
        calcium: totals.calcium,
        iron: totals.iron,
        magnesium: totals.magnesium,
        zinc: totals.zinc,
        vitaminA: totals.vitaminA,
        vitaminC: totals.vitaminC,
        vitaminD: totals.vitaminD,
        vitaminB12: totals.vitaminB12,
        folate: totals.folate,
      },
      resolved.foods.map((food) => ({
        name: food.name,
        amount: food.estimatedAmount,
        unit: food.unit,
        entryId: food.entryId,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sodium: food.sodium,
        potassium: food.potassium,
        calcium: food.calcium,
        iron: food.iron,
        magnesium: food.magnesium,
        zinc: food.zinc,
        vitaminA: food.vitaminA,
        vitaminC: food.vitaminC,
        vitaminD: food.vitaminD,
        vitaminB12: food.vitaminB12,
        folate: food.folate,
      })),
    );

    // Persisted breakdown keeps the micros…
    const [reloaded] = await getTodayMeals();
    expect(reloaded.id).toBe(logged.id);
    expect(reloaded.foods![0]).toMatchObject({
      vitaminA: 200,
      vitaminD: 0.4,
    });

    // …and reopening for edit restores them into review rows.
    const reopened = mealToEstimate(reloaded);
    expect(reopened.foods[0]).toMatchObject({
      vitaminA: 200,
      vitaminD: 0.4,
    });

    const row = toFoodRow(reopened.foods[0]);
    expect(row.micros).toMatchObject({
      vitaminA: 200,
      vitaminD: 0.4,
    });
  });

  it("(S) editing an existing meal recalculates totals from its foods", async () => {
    const logged = await addMeal(
      "Eggs",
      { calories: 140, protein: 12, carbs: 2, fat: 10 },
      [
        {
          name: "Boiled egg",
          amount: 2,
          unit: "piece",
          entryId: "boiled-egg",
          calories: 140,
          protein: 12,
          carbs: 2,
          fat: 10,
        },
      ],
    );

    // Doubling the breakdown and saving recalculates the meal totals.
    const updated = await updateMeal(logged.id, "Eggs", {
      calories: 280,
      protein: 24,
      carbs: 4,
      fat: 20,
    }, [
      {
        name: "Boiled egg",
        amount: 4,
        unit: "piece",
        entryId: "boiled-egg",
        calories: 280,
        protein: 24,
        carbs: 4,
        fat: 20,
      },
    ]);

    expect(updated).not.toBeNull();
    expect(updated!.calories).toBe(280);

    const totals = await getDailyMacroTotals(getTodayKey());
    expect(totals.calories).toBe(280);
    expect(totals.protein).toBe(24);
  });

  it("deleting a meal decreases daily consumed calories", async () => {
    const first = await addMeal("Eggs", { calories: 140 });
    await addMeal("Curd", { calories: 90 });

    expect(
      (await getDailyMacroTotals(getTodayKey())).calories,
    ).toBe(230);

    await deleteMeal(first.id);

    expect(
      (await getDailyMacroTotals(getTodayKey())).calories,
    ).toBe(90);
  });
});
