import {
  parseLeadingQuantity,
  splitDescriptionSegments,
} from "@/services/meal-description-parsing";
import {
  FOOD_DEFINITIONS,
  findFoodDefinition,
  calculateFoodMacros,
} from "@/data/foods";
import {
  resolveSegments,
  resolveLogText,
} from "@/services/nourish/resolve-log";

describe("Part 11: meal description parsing", () => {
  describe("splitDescriptionSegments", () => {
    it("splits on commas, semicolons, pluses, ampersands, and newlines", () => {
      const input = "6 eggs, 1 tbsp ghee; half tomato + half onion & salt";
      const segments = splitDescriptionSegments(input);
      expect(segments).toEqual([
        "6 eggs",
        "1 tbsp ghee",
        "half tomato",
        "half onion",
        "salt",
      ]);
    });

    it("splits on newlines in multiline input", () => {
      const input = "1 cup rajma\n2 onions\n1 tbsp oil";
      const segments = splitDescriptionSegments(input);
      expect(segments).toEqual(["1 cup rajma", "2 onions", "1 tbsp oil"]);
    });

    it("does not split decimals like 1.5 or 0.5", () => {
      const input = "1.5 cups rice and 0.5 cup dal";
      const segments = splitDescriptionSegments(input);
      expect(segments).toEqual(["1.5 cups rice", "0.5 cup dal"]);
    });

    it("splits on whole-word conjunctions without breaking words like coriander", () => {
      const input = "chicken with coriander and rice plus ghee";
      const segments = splitDescriptionSegments(input);
      expect(segments).toEqual(["chicken", "coriander", "rice", "ghee"]);
    });
  });

  describe("parseLeadingQuantity", () => {
    it("parses numbers and units", () => {
      expect(parseLeadingQuantity("6 eggs")).toMatchObject({
        name: "eggs",
        amount: 6,
      });
      expect(parseLeadingQuantity("1 tablespoon ghee")).toMatchObject({
        name: "ghee",
        amount: 1,
        unit: "tablespoon",
      });
      expect(parseLeadingQuantity("1 tbsp oil")).toMatchObject({
        name: "oil",
        amount: 1,
        unit: "tbsp",
      });
      expect(parseLeadingQuantity("100g chicken")).toMatchObject({
        name: "chicken",
        amount: 100,
        unit: "g",
      });
      expect(parseLeadingQuantity("250g paneer")).toMatchObject({
        name: "paneer",
        amount: 250,
        unit: "g",
      });
      expect(parseLeadingQuantity("2 rotis")).toMatchObject({
        name: "rotis",
        amount: 2,
      });
      expect(parseLeadingQuantity("1 banana")).toMatchObject({
        name: "banana",
        amount: 1,
      });
    });

    it("parses fractions: slash and unicode", () => {
      expect(parseLeadingQuantity("1/2 cup rajma")).toMatchObject({
        name: "rajma",
        amount: 0.5,
        unit: "cup",
      });
      expect(parseLeadingQuantity("½ cup rajma")).toMatchObject({
        name: "rajma",
        amount: 0.5,
        unit: "cup",
      });
      expect(parseLeadingQuantity("1 1/2 cups rice")).toMatchObject({
        name: "rice",
        amount: 1.5,
        unit: "cups",
      });
      expect(parseLeadingQuantity("1½ tbsp ghee")).toMatchObject({
        name: "ghee",
        amount: 1.5,
        unit: "tbsp",
      });
      expect(parseLeadingQuantity("3/4 scoop protein")).toMatchObject({
        name: "protein",
        amount: 0.75,
      });
    });

    it("parses words: half, quarter, couple, handful, pinch", () => {
      expect(parseLeadingQuantity("half tomato")).toMatchObject({
        name: "tomato",
        amount: 0.5,
      });
      expect(parseLeadingQuantity("half an onion")).toMatchObject({
        name: "onion",
        amount: 0.5,
      });
      expect(parseLeadingQuantity("quarter cup milk")).toMatchObject({
        name: "milk",
        amount: 0.25,
        unit: "cup",
      });
      expect(parseLeadingQuantity("one and a half cups rice")).toMatchObject({
        name: "rice",
        amount: 1.5,
        unit: "cups",
      });
      expect(parseLeadingQuantity("a couple of eggs")).toMatchObject({
        name: "eggs",
        amount: 2,
      });
      expect(parseLeadingQuantity("a handful of almonds")).toMatchObject({
        name: "almonds",
        amount: 1,
        unit: "handful",
      });
      expect(parseLeadingQuantity("a pinch of salt")).toMatchObject({
        name: "salt",
        amount: 1,
        unit: "pinch",
      });
      expect(parseLeadingQuantity("salt to taste")).toMatchObject({
        name: "salt",
        amount: 0,
        unit: "to taste",
      });
    });

    it("parses sizes: small, medium, large", () => {
      expect(parseLeadingQuantity("1 medium onion")).toMatchObject({
        name: "onion",
        amount: 1,
        size: "medium",
      });
      expect(parseLeadingQuantity("small potato")).toMatchObject({
        name: "potato",
        amount: 1,
        size: "small",
      });
      expect(parseLeadingQuantity("2 large eggs")).toMatchObject({
        name: "eggs",
        amount: 2,
        size: "large",
      });
    });

    it("parses everyday culinary units", () => {
      expect(parseLeadingQuantity("2 cloves garlic")).toMatchObject({
        name: "garlic",
        amount: 2,
        unit: "cloves",
      });
      expect(parseLeadingQuantity("1 slice bread")).toMatchObject({
        name: "bread",
        amount: 1,
        unit: "slice",
      });
      expect(parseLeadingQuantity("1 bowl curd")).toMatchObject({
        name: "curd",
        amount: 1,
        unit: "bowl",
      });
      expect(parseLeadingQuantity("1 katori dal")).toMatchObject({
        name: "dal",
        amount: 1,
        unit: "katori",
      });
      expect(parseLeadingQuantity("1 glass milk")).toMatchObject({
        name: "milk",
        amount: 1,
        unit: "glass",
      });
    });
  });
});

describe("Part 11: Food catalogue integrity", () => {
  it("has no duplicate aliases across definitions", () => {
    const seen = new Map<string, string>();
    for (const def of FOOD_DEFINITIONS) {
      for (const alias of def.aliases) {
        const norm = alias.toLowerCase().trim();
        const prev = seen.get(norm);
        if (prev && prev !== def.id) {
          throw new Error(
            `Duplicate alias '${norm}' found in '${def.id}' and '${prev}'`,
          );
        }
        seen.set(norm, def.id);
      }
    }
    expect(seen.size).toBeGreaterThan(50);
  });

  it("has strictly positive unit weights when specified", () => {
    for (const def of FOOD_DEFINITIONS) {
      if (def.pieceG !== undefined) expect(def.pieceG).toBeGreaterThan(0);
      if (def.cupG !== undefined) expect(def.cupG).toBeGreaterThan(0);
      if (def.tbspG !== undefined) expect(def.tbspG).toBeGreaterThan(0);
      if (def.tspG !== undefined) expect(def.tspG).toBeGreaterThan(0);
      if (def.katoriG !== undefined) expect(def.katoriG).toBeGreaterThan(0);
      if (def.glassG !== undefined) expect(def.glassG).toBeGreaterThan(0);
      if (def.cloveG !== undefined) expect(def.cloveG).toBeGreaterThan(0);
      if (def.sliceG !== undefined) expect(def.sliceG).toBeGreaterThan(0);
      if (def.handfulG !== undefined) expect(def.handfulG).toBeGreaterThan(0);
      if (def.pinchG !== undefined) expect(def.pinchG).toBeGreaterThan(0);
    }
  });

  it("explicitly labels raw vs cooked where relevant", () => {
    const names = FOOD_DEFINITIONS.map((d) => d.name);
    expect(names).toContain("Rice (cooked)");
    expect(names).toContain("Rice (raw)");
    expect(names).toContain("Dal (cooked)");
    expect(names).toContain("Toor dal (raw)");
    expect(names).toContain("Rajma (cooked)");
    expect(names).toContain("Rajma (raw)");
    expect(names).toContain("Chicken (cooked)");
    expect(names).toContain("Chicken breast (raw)");
  });

  it("calculates accurate macros with unit conversions", () => {
    const oil = findFoodDefinition("oil")!;
    expect(oil).toBeDefined();
    const oilMacros = calculateFoodMacros(oil, 1, "tbsp");
    expect(oilMacros.calories).toBeGreaterThan(100);
    expect(oilMacros.fat).toBeGreaterThan(12);

    const salt = findFoodDefinition("salt")!;
    expect(salt).toBeDefined();
    const saltMacros = calculateFoodMacros(salt, 1, "tsp");
    expect(saltMacros.calories).toBe(0);
    expect(saltMacros.protein).toBe(0);

    const onion = findFoodDefinition("onion")!;
    expect(onion).toBeDefined();
    // 2 onions = 2 * 100g = 200g
    const onionMacros = calculateFoodMacros(onion, 2);
    expect(onionMacros.calories).toBe(80);
  });
});

describe("Part 11: Offline Resolution (resolveSegments & resolveLogText)", () => {
  it("resolves the exact screenshot recipe offline without an AI proxy", async () => {
    const recipe = "6 eggs, 1 tablespoon ghee, half tomato, half onion";
    const segments = await resolveSegments(recipe, { saved: [], provider: null });

    expect(segments).toHaveLength(4);
    for (const seg of segments) {
      expect(["matched", "estimated"]).toContain(seg.status);
      expect(seg.item).toBeDefined();
      expect(seg.item!.calories).toBeGreaterThan(0);
    }

    const egg = segments[0]!.item!;
    expect(egg.name.toLowerCase()).toContain("egg");
    expect(egg.calories).toBeGreaterThan(350);

    const ghee = segments[1]!.item!;
    expect(ghee.name.toLowerCase()).toContain("ghee");
    expect(ghee.calories).toBeGreaterThan(100);

    const tomato = segments[2]!.item!;
    expect(tomato.name.toLowerCase()).toContain("tomato");
    expect(tomato.calories).toBeGreaterThan(0);

    const onion = segments[3]!.item!;
    expect(onion.name.toLowerCase()).toContain("onion");
    expect(onion.calories).toBeGreaterThan(0);
  });

  it("resolves the error message's own example offline", async () => {
    const recipe = "1 cup rajma, 2 onions, 1 tbsp oil";
    const segments = await resolveSegments(recipe, { saved: [], provider: null });

    expect(segments).toHaveLength(3);
    for (const seg of segments) {
      expect(["matched", "estimated"]).toContain(seg.status);
      expect(seg.item).toBeDefined();
      expect(seg.item!.calories).toBeGreaterThan(0);
    }

    const rajma = segments[0]!.item!;
    expect(rajma.name.toLowerCase()).toContain("rajma");
    expect(rajma.calories).toBeGreaterThan(200);

    const onions = segments[1]!.item!;
    expect(onions.name.toLowerCase()).toContain("onion");
    expect(onions.calories).toBeGreaterThan(60);

    const oil = segments[2]!.item!;
    expect(oil.name.toLowerCase()).toContain("oil");
    expect(oil.calories).toBeGreaterThan(100);
  });

  it("returns needs-input for unknown ingredients with human reason", async () => {
    const input = "1 cup rice, 100g dragonfruit powder";
    const segments = await resolveSegments(input, { saved: [], provider: null });

    expect(segments).toHaveLength(2);
    expect(["matched", "estimated"]).toContain(segments[0]!.status);
    expect(segments[1]!.status).toBe("needs-input");
    expect(segments[1]!.reason).toContain("Don't know 'dragonfruit powder' yet");
    expect(segments[1]!.item?.calories).toBe(0);
  });

  it("resolveLogText handles full offline resolution safely", async () => {
    const out = await resolveLogText(
      "6 eggs, 1 tablespoon ghee, half tomato, half onion",
      { saved: [], provider: null },
    );

    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.items).toHaveLength(4);
    }
  });

  it("resolveLogText returns manual when an ingredient is unknown", async () => {
    const out = await resolveLogText(
      "1 cup rice, 100g dragonfruit powder",
      { saved: [], provider: null },
    );

    expect(out.status).toBe("manual");
  });
});
