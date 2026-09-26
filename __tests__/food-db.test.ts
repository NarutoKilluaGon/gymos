import {
  FOOD_DATABASE,
  foodEntryToEstimate,
  getFoodEntry,
  scalePortionMacros,
  searchFoods,
} from "@/services/food-db";

describe("FOOD_DATABASE", () => {
  it("ships a V1-sized catalog", () => {
    expect(FOOD_DATABASE.length).toBeGreaterThanOrEqual(70);
    expect(FOOD_DATABASE.length).toBeLessThanOrEqual(90);
  });

  it("has unique ids", () => {
    const ids = FOOD_DATABASE.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has positive portions and finite non-negative macros", () => {
    for (const entry of FOOD_DATABASE) {
      expect(entry.amount).toBeGreaterThan(0);

      for (const macro of [
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fat,
      ]) {
        expect(Number.isFinite(macro)).toBe(true);
        expect(macro).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("covers the dosa-plus-ghee example", () => {
    expect(getFoodEntry("masala-dosa")?.name).toBe("Masala dosa");
    expect(getFoodEntry("ghee")).toMatchObject({
      amount: 1,
      unit: "tbsp",
      calories: 135,
      fat: 15,
    });
  });

  it("returns undefined for unknown ids", () => {
    expect(getFoodEntry("not-a-food")).toBeUndefined();
  });
});

describe("searchFoods", () => {
  it("returns the full catalog for an empty query", () => {
    expect(searchFoods("")).toHaveLength(FOOD_DATABASE.length);
    expect(searchFoods("   ")).toHaveLength(FOOD_DATABASE.length);
  });

  it("is case-insensitive and trims whitespace", () => {
    const results = searchFoods("  GHEE ");

    expect(results.length).toBeGreaterThan(0);

    for (const entry of results) {
      expect(entry.name.toLowerCase()).toContain("ghee");
    }
  });

  it("matches substrings across the catalog", () => {
    const names = searchFoods("chicken").map((entry) => entry.name);

    expect(names).toContain("Chicken biryani");
    expect(names).toContain("Chicken curry");
  });

  it("returns nothing for a query with no matches", () => {
    expect(searchFoods("asdfg")).toEqual([]);
  });
});

describe("scalePortionMacros", () => {
  const ghee = {
    amount: 1,
    calories: 135,
    protein: 0,
    carbs: 0,
    fat: 15,
  };

  // Micro-less bases (pre-S1 shape) scale macros and zero the micros.
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

  it("scales every macro proportionally (2 tbsp ghee)", () => {
    expect(scalePortionMacros(ghee, 2)).toEqual({
      calories: 270,
      protein: 0,
      carbs: 0,
      fat: 30,
      ...MICRO_ZEROS,
    });
  });

  it("supports fractional amounts", () => {
    expect(scalePortionMacros(ghee, 0.5)).toEqual({
      calories: 67.5,
      protein: 0,
      carbs: 0,
      fat: 7.5,
      ...MICRO_ZEROS,
    });
  });

  it("rounds to 2 decimals", () => {
    expect(
      scalePortionMacros(
        { amount: 3, calories: 100, protein: 0, carbs: 0, fat: 0 },
        1,
      ),
    ).toEqual({
      calories: 33.33,
      protein: 0,
      carbs: 0,
      fat: 0,
      ...MICRO_ZEROS,
    });
  });

  it("contributes zero for zero, negative, or non-finite amounts", () => {
    const zero = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      ...MICRO_ZEROS,
    };

    expect(scalePortionMacros(ghee, 0)).toEqual(zero);
    expect(scalePortionMacros(ghee, -2)).toEqual(zero);
    expect(scalePortionMacros(ghee, Number.NaN)).toEqual(zero);
  });
});

describe("foodEntryToEstimate", () => {
  it("wraps an entry as a single-food estimate with matching totals", () => {
    const entry = getFoodEntry("masala-dosa");
    const estimate = foodEntryToEstimate(entry!);

    expect(estimate.foods).toHaveLength(1);
    expect(estimate.foods[0]).toMatchObject({
      name: "Masala dosa",
      estimatedAmount: 1,
      unit: "piece",
      calories: 250,
      protein: 6,
      carbs: 45,
      fat: 5,
    });
    expect(estimate.totals).toEqual({
      calories: 250,
      protein: 6,
      carbs: 45,
      fat: 5,
      fiber: 2,
      sodium: 300,
      potassium: 250,
      calcium: 30,
      iron: 1.5,
      magnesium: 30,
      zinc: 0.5,
      vitaminA: 5,
      vitaminC: 4,
      vitaminD: 0,
      vitaminB12: 0,
      folate: 40,
    });
  });
});
