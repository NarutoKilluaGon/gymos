import { computeMealTotals } from "@/services/meal-estimator";
import type { MealFood } from "@/types/gymos";

describe("computeMealTotals", () => {
  // Totals now carry the full 15-nutrient shape (micros zero when absent).
  const MICRO_ZEROS = {
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    magnesium: 0,
    zinc: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
    vitaminB12: 0,
    folate: 0,
  };

  it("returns zeros for an empty breakdown", () => {
    expect(computeMealTotals([])).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      ...MICRO_ZEROS,
    });
  });

  it("sums foods without additionals", () => {
    const foods: MealFood[] = [
      {
        name: "Masala dosa",
        calories: 250,
        protein: 6,
        carbs: 45,
        fat: 5,
      },
      {
        name: "Sambar",
        calories: 130,
        protein: 6,
        carbs: 22,
        fat: 3,
      },
    ];

    expect(computeMealTotals(foods)).toEqual({
      calories: 380,
      protein: 12,
      carbs: 67,
      fat: 8,
      ...MICRO_ZEROS,
    });
  });

  it("includes per-food additionals (dosa + 2 tbsp ghee)", () => {
    const foods: MealFood[] = [
      {
        name: "Masala dosa",
        calories: 250,
        protein: 6,
        carbs: 45,
        fat: 5,
        additionals: [
          {
            id: "a1",
            entryId: "ghee",
            name: "Ghee",
            amount: 2,
            unit: "tbsp",
            calories: 270,
            protein: 0,
            carbs: 0,
            fat: 30,
          },
        ],
      },
    ];

    expect(computeMealTotals(foods)).toEqual({
      calories: 520,
      protein: 6,
      carbs: 45,
      fat: 35,
      ...MICRO_ZEROS,
    });
  });

  it("treats a missing additionals field as no additionals", () => {
    const foods: MealFood[] = [
      {
        name: "Idli",
        calories: 140,
        protein: 5,
        carbs: 30,
        fat: 1,
      },
    ];

    expect(computeMealTotals(foods)).toEqual({
      calories: 140,
      protein: 5,
      carbs: 30,
      fat: 1,
      ...MICRO_ZEROS,
    });
  });

  it("rounds fractional sums to 2 decimals", () => {
    const foods: MealFood[] = [
      {
        name: "A",
        calories: 0.1,
        protein: 0.2,
        carbs: 0,
        fat: 0,
        additionals: [
          {
            id: "a1",
            name: "B",
            amount: 1,
            unit: "tbsp",
            calories: 0.2,
            protein: 0.1,
            carbs: 0,
            fat: 0,
          },
        ],
      },
    ];

    expect(computeMealTotals(foods)).toEqual({
      calories: 0.3,
      protein: 0.3,
      carbs: 0,
      fat: 0,
      ...MICRO_ZEROS,
    });
  });
});
