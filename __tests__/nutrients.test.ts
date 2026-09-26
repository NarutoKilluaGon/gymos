import {
  FOOD_DATABASE,
  getFoodEntry,
  scalePortionMacros,
} from "@/services/food-db";
import {
  computeMealTotals,
  mealInputFromEstimate,
  resolveSegmentLocally,
  type MealEstimate,
} from "@/services/meal-estimator";
import { MICRONUTRIENT_KEYS } from "@/types/gymos";
import type { MealFood } from "@/types/gymos";

describe("food database micronutrients", () => {
  it("backfills every entry with finite non-negative micros", () => {
    expect(FOOD_DATABASE.length).toBeGreaterThanOrEqual(70);

    for (const entry of FOOD_DATABASE) {
      for (const key of MICRONUTRIENT_KEYS) {
        const value = entry[key];

        expect(typeof value).toBe("number");
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("spot-checks known values (ghee vitamin A)", () => {
    expect(getFoodEntry("ghee")).toMatchObject({
      vitaminA: 100,
      fiber: 0,
    });
  });
});

describe("scalePortionMacros with micros", () => {
  it("scales micros with macros (2 tbsp ghee)", () => {
    const scaled = scalePortionMacros(getFoodEntry("ghee")!, 2);

    expect(scaled.fat).toBe(30);
    expect(scaled.vitaminA).toBe(200);
    expect(scaled.vitaminD).toBe(0.4);
    expect(scaled.fiber).toBe(0);
  });

  it("treats missing micros as untracked zero", () => {
    const scaled = scalePortionMacros(
      { amount: 100, calories: 200, protein: 10, carbs: 30, fat: 5 },
      50,
    );

    expect(scaled.calories).toBe(100);
    expect(scaled.fiber).toBe(0);
    expect(scaled.vitaminC).toBe(0);
  });
});

describe("computeMealTotals with micros", () => {
  it("sums micros across foods and additionals", () => {
    const foods: MealFood[] = [
      {
        name: "Masala dosa",
        calories: 250,
        protein: 6,
        carbs: 45,
        fat: 5,
        fiber: 2,
        vitaminC: 4,
        iron: 0.1,
        additionals: [
          {
            id: "a1",
            name: "Ghee",
            amount: 2,
            unit: "tbsp",
            calories: 270,
            protein: 0,
            carbs: 0,
            fat: 30,
            vitaminA: 200,
            iron: 0.2,
          },
        ],
      },
    ];

    const totals = computeMealTotals(foods);

    expect(totals.calories).toBe(520);
    expect(totals.fiber).toBe(2);
    expect(totals.vitaminA).toBe(200);
    expect(totals.vitaminC).toBe(4);
    expect(totals.iron).toBe(0.3);
    expect(totals.sodium).toBe(0);
    expect(Object.keys(totals)).toHaveLength(16);
  });

  it("keeps legacy micro-less foods valid with zeroed micros", () => {
    const totals = computeMealTotals([
      { name: "X", calories: 100, protein: 10, carbs: 20, fat: 5 },
    ]);

    expect(totals.calories).toBe(100);
    expect(totals.protein).toBe(10);
    expect(totals.fiber).toBe(0);
    expect(totals.vitaminD).toBe(0);
  });
});

describe("DB nutrition with micros wins on exact local match", () => {
  it("resolves catalog micros scaled to the stated amount", () => {
    const food = resolveSegmentLocally("2 tbsp ghee");

    expect(food.unresolved).toBeUndefined();
    expect(food.entryId).toBe("ghee");
    expect(food.vitaminA).toBe(200);
    expect(food.calories).toBe(270);
  });
});

describe("mealInputFromEstimate carries micros", () => {
  it("forwards micro totals to the save path", () => {
    const input = mealInputFromEstimate({
      foods: [],
      totals: {
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
        fiber: 3,
        vitaminC: 25,
      },
    });

    expect(input.calories).toBe(200);
    expect(input.fiber).toBe(3);
    expect(input.vitaminC).toBe(25);
  });
});
