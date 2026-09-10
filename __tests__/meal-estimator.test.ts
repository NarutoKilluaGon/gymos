import { searchQuickMeals } from "@/services/meal-estimator";

describe("searchQuickMeals", () => {
  it("returns the full catalog for an empty query", () => {
    const results = searchQuickMeals("");
    expect(results.length).toBeGreaterThan(10);
  });

  it("is case-insensitive and trims whitespace", () => {
    const results = searchQuickMeals("  CHICKEN ");
    expect(results.length).toBeGreaterThan(0);

    for (const meal of results) {
      expect(meal.name.toLowerCase()).toContain("chicken");
    }
  });

  it("returns every catalog meal containing the query", () => {
    const chicken = searchQuickMeals("chicken");
    const names = chicken.map((meal) => meal.name.toLowerCase());

    expect(names).toContain("chicken breast (150g)");
    expect(names).toContain("chicken burrito bowl");
  });

  it("returns nothing for a query with no matches", () => {
    expect(searchQuickMeals("asdfg")).toEqual([]);
  });

  it("exposes estimated macros on results", () => {
    const eggs = searchQuickMeals("eggs")[0];
    expect(typeof eggs.calories).toBe("number");
    expect(typeof eggs.protein).toBe("number");
  });
});