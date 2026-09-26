import {
  getFoodEntry,
  isSameUnit,
  matchFoodEntry,
} from "@/services/food-db";

describe("matchFoodEntry", () => {
  it("matches exactly, case-insensitively", () => {
    expect(matchFoodEntry("Ghee")?.id).toBe("ghee");
    expect(matchFoodEntry("  MASAla DOSA  ")?.id).toBe("masala-dosa");
  });

  it("resolves ambiguous substrings deterministically", () => {
    // "dosa" is a partial overlap for three entries; longest wins.
    expect(matchFoodEntry("dosa")?.id).toBe("masala-dosa");
  });

  it("finds entries contained in longer phrases", () => {
    expect(matchFoodEntry("idli with sambar")?.id).toBe("sambar");
  });

  it("returns undefined for unknown or empty names", () => {
    expect(matchFoodEntry("quinoa salad")).toBeUndefined();
    expect(matchFoodEntry("   ")).toBeUndefined();
  });

  it("matches plural-insensitively on both sides", () => {
    expect(matchFoodEntry("2 omelettes", 3)).toBeUndefined(); // quantity text is not a name
    expect(matchFoodEntry("omelettes", 3)?.id).toBe("omelette");
    expect(matchFoodEntry("oats", 3)?.id).toBe("oats");
  });

  it("resolves everyday variants through aliases, never partial dishes", () => {
    expect(matchFoodEntry("yogurt", 3)?.id).toBe("curd");
    expect(matchFoodEntry("YOGHURT", 3)?.id).toBe("curd");
    expect(matchFoodEntry("dahi", 3)?.id).toBe("curd");
    expect(matchFoodEntry("egg", 3)?.id).toBe("boiled-egg");
    expect(matchFoodEntry("eggs", 3)?.id).toBe("boiled-egg");
    expect(matchFoodEntry("omelette", 3)?.id).toBe("omelette");
    expect(matchFoodEntry("egg omelette", 3)?.id).toBe("omelette");
    expect(matchFoodEntry("cooked rice", 3)?.id).toBe("cooked-rice");
    expect(matchFoodEntry("roti", 3)?.id).toBe("roti");
    expect(matchFoodEntry("rotis", 3)?.id).toBe("roti");
    // Bare "rice" names no single dish — it stays unresolved rather
    // than guessing among the five rice entries.
    expect(matchFoodEntry("rice", 3)).toBeUndefined();
    // A dish merely containing a catalog name never aliases.
    expect(matchFoodEntry("homemade paneer curry", 3)).toBeUndefined();
    expect(matchFoodEntry("egg curry", 3)?.id).toBe("egg-curry");
  });

  it("never matches a dish that merely contains a catalog name", () => {
    // Exact-only resolution (minScore 3) is what local resolution uses:
    // "homemade paneer curry" must not become plain "Paneer".
    expect(matchFoodEntry("homemade paneer curry", 3)).toBeUndefined();
    expect(matchFoodEntry("paneer", 3)?.id).toBe("paneer");
  });
});

describe("isSameUnit", () => {
  it("matches identical units ignoring case/space/punctuation", () => {
    expect(isSameUnit("tbsp", "Tbsp")).toBe(true);
    expect(isSameUnit(" tbsp ", "tbsp.")).toBe(true);
    expect(isSameUnit("g", "g")).toBe(true);
  });

  it("matches unit spelling variants for the same unit", () => {
    expect(isSameUnit("tablespoon", "tbsp")).toBe(true);
    expect(isSameUnit("Tablespoons", "tbsp")).toBe(true);
    expect(isSameUnit("gm", "g")).toBe(true);
    expect(isSameUnit("grams", "g")).toBe(true);
    expect(isSameUnit("cups", "cup")).toBe(true);
    expect(isSameUnit("piece", "pieces")).toBe(true);
    expect(isSameUnit("milliliter", "ml")).toBe(true);
  });

  it("rejects mismatches so no conversion is attempted", () => {
    expect(isSameUnit("cup", "g")).toBe(false);
    expect(isSameUnit("tbsp", "tsp")).toBe(false);
    expect(isSameUnit("glass", "ml")).toBe(false);
    expect(isSameUnit("", "g")).toBe(false);
  });
});

describe("catalog pins used across the local-resolution tests", () => {
  it("references catalog entries used across the DB-priority tests", () => {
    expect(getFoodEntry("ghee")?.calories).toBe(135);
    expect(getFoodEntry("paneer")?.amount).toBe(100);
    expect(getFoodEntry("cooked-rice")).toMatchObject({
      amount: 100,
      unit: "g",
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
    });
  });
});
