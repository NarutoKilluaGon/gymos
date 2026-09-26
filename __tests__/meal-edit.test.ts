import {
  mealFoodsLine,
  mealToEstimate,
} from "@/services/meal-estimator";
import {
  addMeal,
  getTodayMeals,
  updateMeal,
} from "@/storage/repositories/meals";
import type { Meal } from "@/types/gymos";

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

beforeEach(() => {
  storageMock.__reset();
});

describe("mealToEstimate", () => {
  it("converts a saved breakdown back to editable foods", () => {
    const meal: Meal = {
      id: "m1",
      name: "Dosa + ghee",
      timestamp: "2026-09-24T08:30:00.000Z",
      calories: 385,
      protein: 6,
      carbs: 45,
      fat: 20,
      foods: [
        {
          name: "Masala dosa",
          amount: 1,
          unit: "piece",
          calories: 250,
          protein: 6,
          carbs: 45,
          fat: 5,
        },
        {
          name: "Ghee",
          amount: 1,
          unit: "tbsp",
          calories: 135,
          protein: 0,
          carbs: 0,
          fat: 15,
          additionals: [],
        },
      ],
    };

    const estimate = mealToEstimate(meal);

    expect(estimate.foods).toHaveLength(2);
    expect(estimate.foods[0]).toMatchObject({
      name: "Masala dosa",
      estimatedAmount: 1,
      unit: "piece",
      calories: 250,
    });
    expect(estimate.foods[1]).toMatchObject({
      name: "Ghee",
      estimatedAmount: 1,
      unit: "tbsp",
    });
    // Totals come from the authoritative flat fields.
    expect(estimate.totals).toEqual({
      calories: 385,
      protein: 6,
      carbs: 45,
      fat: 20,
    });
  });

  it("yields zero food rows for totals-only meals", () => {
    const meal: Meal = {
      id: "m2",
      name: "Banana",
      timestamp: "2026-09-24T08:30:00.000Z",
      calories: 105,
      protein: 1,
      carbs: 27,
      fat: 0,
    };

    const estimate = mealToEstimate(meal);

    expect(estimate.foods).toEqual([]);
    expect(estimate.totals.calories).toBe(105);
  });
});

describe("mealFoodsLine", () => {
  it("returns null when the foods merely repeat the title", () => {
    expect(
      mealFoodsLine("Masala dosa, Ghee", [
        {
          name: "Masala dosa",
          calories: 250,
          protein: 6,
          carbs: 45,
          fat: 5,
        },
        { name: "Ghee", calories: 135, protein: 0, carbs: 0, fat: 15 },
      ]),
    ).toBeNull();
  });

  it("shows the line when it adds information", () => {
    expect(
      mealFoodsLine("Breakfast", [
        { name: "Eggs", calories: 180, protein: 12, carbs: 1, fat: 14 },
        { name: "Toast", calories: 140, protein: 5, carbs: 26, fat: 2 },
      ]),
    ).toBe("Eggs + Toast");
  });

  it("returns null without foods", () => {
    expect(mealFoodsLine("Banana")).toBeNull();
    expect(mealFoodsLine("Banana", [])).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(
      mealFoodsLine("EGGS AND TOAST", [
        { name: "Eggs", calories: 1, protein: 1, carbs: 1, fat: 1 },
      ]),
    ).toBeNull();
  });
});

describe("updateMeal", () => {
  it("updates in place without duplicating", async () => {
    const created = await addMeal(
      "Dosa",
      { calories: 250, protein: 6, carbs: 45, fat: 5 },
      [
        {
          name: "Masala dosa",
          calories: 250,
          protein: 6,
          carbs: 45,
          fat: 5,
        },
      ],
    );

    const updated = await updateMeal(
      created.id,
      "Dosa + ghee",
      { calories: 385, protein: 6, carbs: 45, fat: 20 },
      [
        {
          name: "Masala dosa",
          calories: 250,
          protein: 6,
          carbs: 45,
          fat: 5,
        },
        {
          name: "Ghee",
          amount: 1,
          unit: "tbsp",
          calories: 135,
          protein: 0,
          carbs: 0,
          fat: 15,
        },
      ],
    );

    expect(updated).toMatchObject({
      id: created.id,
      name: "Dosa + ghee",
      calories: 385,
      fat: 20,
    });
    expect(updated?.timestamp).toBe(created.timestamp);
    expect(updated?.foods).toHaveLength(2);

    const todays = await getTodayMeals();
    expect(todays).toHaveLength(1);
    expect(todays[0].name).toBe("Dosa + ghee");
  });

  it("returns null for an unknown id and changes nothing", async () => {
    await addMeal("Dosa", { calories: 250 });

    expect(await updateMeal("missing", "X", {})).toBeNull();
    expect(await getTodayMeals()).toHaveLength(1);
  });

  it("clears a previously saved breakdown when foods are empty", async () => {
    const created = await addMeal(
      "Dosa",
      { calories: 250 },
      [{ name: "Masala dosa", calories: 250, protein: 0, carbs: 0, fat: 0 }],
    );

    const updated = await updateMeal(created.id, "Dosa", {
      calories: 250,
    });

    expect(updated?.foods).toBeUndefined();
  });
});
