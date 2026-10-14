import {
  parseLeadingQuantity,
  splitDescriptionSegments,
} from "@/services/meal-description-parsing";
import {
  matchFoodEntry,
  suggestFoodMatches,
  scalePortionMacros,
  isSameUnit,
} from "@/services/food-db";
import {
  findFoodDefinition,
  calculateFoodMacros,
} from "@/data/foods";
import {
  resolveSegmentLocally,
  resolveFoodForMeal,
  resolveMealDescription,
  applyFoodDbPrecedence,
} from "@/services/meal-food-resolution";
import { resolveStage1 } from "@/services/nourish/resolve-log";
import type { SavedFood } from "@/storage/repositories/saved-foods";

describe("Phase A: Food matching, parsing, and precedence", () => {
  describe("1. Whole-phrase matching: Spices & Roti negative tests", () => {
    it("lahori jeera is not Spices (resolves to Lahori jeera cold drink, 80 kcal, 250 ml)", () => {
      // 1. Food DB entry
      const entry = matchFoodEntry("lahori jeera", 3);
      expect(entry).toBeDefined();
      expect(entry?.name).toBe("Lahori jeera");
      expect(entry?.calories).toBe(80);
      expect(entry?.unit).toBe("ml");

      // 2. data/foods definition
      const def = findFoodDefinition("lahori jeera");
      expect(def).toBeDefined();
      expect(def?.id).toBe("lahori_jeera");
      expect(def?.name).toBe("Lahori jeera");
      expect(def?.isZeroCalorie).toBeFalsy();

      // 3. Local resolution
      const resolved = resolveSegmentLocally("lahori jeera");
      expect(resolved.unresolved).toBeUndefined();
      expect(resolved.name).toBe("Lahori jeera");
      expect(resolved.calories).toBe(80);
      expect(resolved.unit).toBe("ml");
    });

    it("jeera still is Spices (exact whole-phrase match, 0 kcal)", () => {
      const def = findFoodDefinition("jeera");
      expect(def).toBeDefined();
      expect(def?.id).toBe("spices");
      expect(def?.name).toBe("Spices");
      expect(def?.isZeroCalorie).toBe(true);

      const macros = calculateFoodMacros(def!, 1, "tsp");
      expect(macros.calories).toBe(0);
      expect(macros.protein).toBe(0);
    });

    it("khameeri roti is not Roti (unresolved, never auto-swapped for phulka)", () => {
      // Must not match Food DB catalog at score 3
      const entry = matchFoodEntry("khameeri roti", 3);
      expect(entry).toBeUndefined();

      // Must not match data/foods definition
      const def = findFoodDefinition("khameeri roti");
      expect(def).toBeUndefined();

      // resolveSegmentLocally must return an unresolved row
      const resolved = resolveSegmentLocally("khameeri roti");
      expect(resolved.unresolved).toBe(true);
      expect(resolved.name).toBe("khameeri roti");
      expect(resolved.calories).toBe(0);

      // resolveFoodForMeal must be unresolved
      const mealResolve = resolveFoodForMeal({ description: "khameeri roti" });
      expect(mealResolve.status).toBe("unresolved");
      if (mealResolve.status !== "none") {
        expect(mealResolve.foods[0]?.unresolved).toBe(true);
      }
    });

    it("plain roti and rotis still resolve to Roti", () => {
      const entry = matchFoodEntry("roti", 3);
      expect(entry).toBeDefined();
      expect(entry?.name).toBe("Roti (phulka)");

      const entryPlural = matchFoodEntry("rotis", 3);
      expect(entryPlural).toBeDefined();
      expect(entryPlural?.name).toBe("Roti (phulka)");
    });
  });

  describe("2. Parsing & Quantity Extraction", () => {
    it("'1 bowl chole, 2 bhature' keeps quantity 2 as pieces with sensible macros", async () => {
      const segments = splitDescriptionSegments("1 bowl chole, 2 bhature");
      expect(segments).toEqual(["1 bowl chole", "2 bhature"]);

      // Segment 1: 1 bowl chole
      const chole = resolveSegmentLocally(segments[0]!);
      expect(chole.unresolved).toBeUndefined();
      expect(chole.name).toBe("Chole masala");
      expect(chole.estimatedAmount).toBe(1);
      expect(chole.unit).toBe("bowl");
      expect(chole.calories).toBe(220);
      expect(chole.protein).toBe(10);
      expect(chole.carbs).toBe(30);
      expect(chole.fat).toBe(7);

      // Segment 2: 2 bhature (quantity 2 must NOT be lost, unit piece)
      const bhature = resolveSegmentLocally(segments[1]!);
      expect(bhature.unresolved).toBeUndefined();
      expect(bhature.name).toBe("Bhatura");
      expect(bhature.estimatedAmount).toBe(2);
      expect(bhature.unit).toBe("piece");
      expect(bhature.calories).toBe(440); // 2 * 220
      expect(bhature.protein).toBe(10); // 2 * 5
      expect(bhature.carbs).toBe(64); // 2 * 32
      expect(bhature.fat).toBe(16); // 2 * 8

      // Stage 1 log resolution test
      const stage1 = await resolveStage1(segments, []);
      expect(stage1.resolutions).toHaveLength(2);
      expect(stage1.resolutions[0]?.status).toBe("matched");
      expect(stage1.resolutions[0]?.item?.name).toBe("Chole masala");
      expect(stage1.resolutions[0]?.item?.qty).toBe("1 bowl");
      expect(stage1.resolutions[0]?.item?.calories).toBe(220);

      expect(stage1.resolutions[1]?.status).toBe("matched");
      expect(stage1.resolutions[1]?.item?.name).toBe("Bhatura");
      expect(stage1.resolutions[1]?.item?.qty).toBe("2 piece");
      expect(stage1.resolutions[1]?.item?.calories).toBe(440);
    });

    it("'1 plate chole bhature' parses and resolves as complete dish", async () => {
      const segments = splitDescriptionSegments("1 plate chole bhature");
      expect(segments).toEqual(["1 plate chole bhature"]);

      const resolved = resolveSegmentLocally(segments[0]!);
      expect(resolved.unresolved).toBeUndefined();
      expect(resolved.name).toBe("Chole bhature (plate)");
      expect(resolved.estimatedAmount).toBe(1);
      expect(resolved.unit).toBe("plate");
      expect(resolved.calories).toBe(650);
      expect(resolved.protein).toBe(16);
      expect(resolved.carbs).toBe(85);
      expect(resolved.fat).toBe(28);

      const stage1 = await resolveStage1(segments, []);
      expect(stage1.resolutions).toHaveLength(1);
      expect(stage1.resolutions[0]?.status).toBe("matched");
      expect(stage1.resolutions[0]?.item?.qty).toBe("1 plate");
      expect(stage1.resolutions[0]?.item?.calories).toBe(650);
    });

    it("matches combined dish names with conjunctions ('and' / 'with') before splitting", () => {
      expect(splitDescriptionSegments("1 plate chole and bhature")).toEqual([
        "1 plate chole bhature",
      ]);
      expect(splitDescriptionSegments("chole with bhature")).toEqual([
        "chole bhature",
      ]);
      expect(splitDescriptionSegments("pav and bhaji")).toEqual(["pav bhaji"]);
      expect(splitDescriptionSegments("rajma and chawal")).toEqual([
        "rajma chawal",
      ]);
    });

    it("'200 g daliya' resolves to cooked daliya scaled to 200g", async () => {
      const segments = splitDescriptionSegments("200 g daliya");
      expect(segments).toEqual(["200 g daliya"]);

      const resolved = resolveSegmentLocally(segments[0]!);
      expect(resolved.unresolved).toBeUndefined();
      expect(resolved.name).toBe("Daliya (cooked)");
      expect(resolved.estimatedAmount).toBe(200);
      expect(resolved.unit).toBe("g");
      expect(resolved.calories).toBe(150); // 2 * 75
      expect(resolved.protein).toBe(5); // 2 * 2.5
      expect(resolved.carbs).toBe(30); // 2 * 15
      expect(resolved.fat).toBe(1.6); // 2 * 0.8

      const stage1 = await resolveStage1(segments, []);
      expect(stage1.resolutions).toHaveLength(1);
      expect(stage1.resolutions[0]?.status).toBe("matched");
      expect(stage1.resolutions[0]?.item?.name).toBe("Daliya (cooked)");
      expect(stage1.resolutions[0]?.item?.qty).toBe("200 g");
      expect(stage1.resolutions[0]?.item?.calories).toBe(150);
    });

    it("supports all requested catalog dishes and sensible values", () => {
      // Bhatura
      expect(matchFoodEntry("bhatura", 3)?.calories).toBe(220);
      expect(matchFoodEntry("bhature", 3)?.calories).toBe(220);

      // Chole masala
      expect(matchFoodEntry("chole", 3)?.calories).toBe(220);
      expect(matchFoodEntry("chana masala", 3)?.calories).toBe(220);

      // Chole bhature plate & piece
      expect(matchFoodEntry("chole bhature", 3)?.calories).toBe(650);
      expect(matchFoodEntry("Chole bhature (piece)", 3)?.calories).toBe(325);

      // Kulcha
      expect(matchFoodEntry("kulcha", 3)?.calories).toBe(180);
      expect(matchFoodEntry("kulche", 3)?.calories).toBe(180);

      // Puri
      expect(matchFoodEntry("puri", 3)?.calories).toBe(100);
      expect(matchFoodEntry("poori", 3)?.calories).toBe(100);

      // Pav bhaji
      expect(matchFoodEntry("pav bhaji", 3)?.calories).toBe(400);

      // Samosa
      expect(matchFoodEntry("samosa", 3)?.calories).toBe(260);

      // Jalebi
      expect(matchFoodEntry("jalebi", 3)?.calories).toBe(95);

      // Lassi
      expect(matchFoodEntry("lassi", 3)?.calories).toBe(180);

      // Jaljeera
      expect(matchFoodEntry("jaljeera", 3)?.calories).toBe(30);

      // Lahori jeera
      expect(matchFoodEntry("lahori jeera", 3)?.calories).toBe(80);

      // Daliya (cooked and dry)
      expect(matchFoodEntry("daliya", 3)?.calories).toBe(75);
      expect(matchFoodEntry("daliya dry", 3)?.calories).toBe(340);
    });
  });

  describe("3. Resolution order: saved food > catalog > cached AI > AI > unresolved", () => {
    const mockSavedRoti: SavedFood = {
      id: "saved-roti-1",
      name: "Roti",
      calories: 120, // User's customized recipe with extra ghee
      protein: 4,
      carbs: 18,
      fat: 3.5,
      qty: "1 piece",
      createdAt: "2026-10-14T12:00:00.000Z",
    };

    it("exact saved food takes precedence over standard catalog entry in resolveSegmentLocally", () => {
      // Without saved food -> standard catalog 80 kcal
      const catalogRoti = resolveSegmentLocally("1 roti", []);
      expect(catalogRoti.calories).toBe(80);
      expect(catalogRoti.nutritionSource).toBe("food-db");

      // With saved food -> user's 120 kcal
      const userRoti = resolveSegmentLocally("1 roti", [mockSavedRoti]);
      expect(userRoti.calories).toBe(120);
      expect(userRoti.protein).toBe(4);
      expect(userRoti.nutritionSource).toBe("manual");
    });

    it("exact saved food takes precedence over standard catalog entry in resolveFoodForMeal", () => {
      const result = resolveFoodForMeal(
        { description: "Roti", amount: 1, unit: "piece" },
        [mockSavedRoti],
      );
      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.foods[0]?.calories).toBe(120);
        expect(result.foods[0]?.nutritionSource).toBe("manual");
      }
    });

    it("exact saved food takes precedence over AI estimate and catalog in applyFoodDbPrecedence", () => {
      const aiEstimate = {
        foods: [
          {
            name: "Roti",
            estimatedAmount: 1,
            unit: "piece",
            calories: 90, // AI guessed 90
            protein: 3,
            carbs: 16,
            fat: 1.5,
          },
        ],
        totals: { calories: 90, protein: 3, carbs: 16, fat: 1.5 },
      };

      // When saved foods exist, user's saved 120 kcal wins over catalog 80 kcal and AI 90 kcal
      const resolved = applyFoodDbPrecedence(aiEstimate, [mockSavedRoti]);
      expect(resolved.foods[0]?.calories).toBe(120);
      expect(resolved.foods[0]?.nutritionSource).toBe("manual");
    });

    it("exact catalog match takes precedence over AI estimate when no saved food exists", () => {
      const aiEstimate = {
        foods: [
          {
            name: "Roti (phulka)",
            estimatedAmount: 2,
            unit: "piece",
            calories: 200, // AI guessed 200
            protein: 6,
            carbs: 35,
            fat: 3,
          },
        ],
        totals: { calories: 200, protein: 6, carbs: 35, fat: 3 },
      };

      const resolved = applyFoodDbPrecedence(aiEstimate, []);
      // Catalog value is 80 kcal per piece -> 160 kcal for 2 pieces
      expect(resolved.foods[0]?.calories).toBe(160);
      expect(resolved.foods[0]?.nutritionSource).toBe("food-db");
    });

    it("partial overlap offers 'Did you mean...?' suggestions but is NEVER auto-applied", () => {
      const suggestions = suggestFoodMatches("roti");
      // "Butter naan" or "Roti (phulka)" candidates
      expect(suggestions.length).toBeGreaterThan(0);

      // But matchFoodEntry with minScore 3 refuses partial names
      expect(matchFoodEntry("homemade butter roti", 3)).toBeUndefined();
      expect(matchFoodEntry("khameeri roti", 3)).toBeUndefined();
    });

    it("unresolved items never save 0 kcal silently", () => {
      const unresolved = resolveSegmentLocally("unknown fruit powder");
      expect(unresolved.unresolved).toBe(true);
      expect(unresolved.calories).toBe(0);
      expect(unresolved.nutritionSource).toBe("manual");

      const mealResolve = resolveFoodForMeal({ description: "unknown fruit powder" });
      expect(mealResolve.status).toBe("unresolved");
      if (mealResolve.status !== "none") {
        expect(mealResolve.foods[0]?.unresolved).toBe(true);
      }
    });
  });
});
