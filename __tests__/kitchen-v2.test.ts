import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  isSavedMeal,
  replaceRecipe,
  restoreSavedFood,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import { logSavedMeal, saveRecipe } from "@/services/nourish/diary";
import { getStorage, setStorage } from "@/storage/storage";
import type { DraftItem } from "@/types/nourish";
import { getAllMeals } from "@/storage/repositories/meals";

describe("Part 12: Nourish Kitchen v2", () => {
  beforeEach(async () => {
    await setStorage("@gymos/saved-foods", []);
    await setStorage("@gymos/meals", []);
  });

  describe("Backward compatibility of saved-foods repository", () => {
    it("loads old saved food records without ingredients and servings", async () => {
      const oldRecords: SavedFood[] = [
        {
          id: "old-1",
          name: "Old Recipe",
          calories: 250,
          protein: 10,
          carbs: 40,
          fat: 5,
          recipe: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "old-2",
          name: "Old Meal",
          foods: [
            { name: "Egg", calories: 70, protein: 6, carbs: 0, fat: 5 },
            { name: "Toast", calories: 80, protein: 3, carbs: 15, fat: 1 },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      await setStorage("@gymos/saved-foods", oldRecords);

      const loaded = await getSavedFoods();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]!.name).toBe("Old Recipe");
      expect(loaded[0]!.ingredients).toBeUndefined();
      expect(loaded[0]!.servings).toBeUndefined();
      expect(loaded[1]!.name).toBe("Old Meal");
    });
  });

  describe("Recipe save with ingredients and servings", () => {
    it("stores ingredients and servings when saving a recipe", async () => {
      const items: DraftItem[] = [
        {
          name: "Rajma (cooked)",
          qty: "1 cup",
          calories: 252,
          protein: 16,
          carbs: 41,
          fat: 1,
          confidence: 0.85,
          multiplier: 1,
          source: "catalog",
        },
        {
          name: "Oil",
          qty: "1 tbsp",
          calories: 124,
          protein: 0,
          carbs: 0,
          fat: 14,
          confidence: 0.85,
          multiplier: 1,
          source: "catalog",
        },
      ];

      const saved = await saveRecipe("Rajma Curry", items, 2);
      expect(saved.name).toBe("Rajma Curry");
      expect(saved.recipe).toBe(true);
      expect(saved.servings).toBe(2);
      expect(saved.ingredients).toHaveLength(2);
      // Total calories = 252 + 124 = 376; per serving (2 servings) = 188
      expect(saved.calories).toBe(188);

      const all = await getSavedFoods();
      const loaded = all.find((f) => f.name === "Rajma Curry")!;
      expect(loaded).toBeDefined();
      expect(loaded.servings).toBe(2);
      expect(loaded.ingredients).toHaveLength(2);
      expect(loaded.ingredients![0]!.name).toBe("Rajma (cooked)");
    });
  });

  describe("Log recipe servings math (½, 1½, custom)", () => {
    it("correctly logs 1 serving of a recipe", async () => {
      const recipe: SavedFood = {
        id: "rec-1",
        name: "Protein Shake",
        calories: 300,
        protein: 30,
        carbs: 20,
        fat: 5,
        recipe: true,
        servings: 1,
        qty: "1 serving",
        createdAt: new Date().toISOString(),
      };

      const logged = await logSavedMeal(recipe, "2026-10-09", new Date(), {
        slot: "Breakfast",
        servingsMultiplier: 1,
      });

      expect(logged).toHaveLength(1);
      expect(logged[0]!.calories).toBe(300);
      expect(logged[0]!.protein).toBe(30);
      expect(logged[0]!.slot).toBe("Breakfast");
    });

    it("correctly logs ½ serving (0.5x) of a recipe", async () => {
      const recipe: SavedFood = {
        id: "rec-1",
        name: "Protein Shake",
        calories: 300,
        protein: 30,
        carbs: 20,
        fat: 5,
        recipe: true,
        servings: 1,
        qty: "1 serving",
        createdAt: new Date().toISOString(),
      };

      const logged = await logSavedMeal(recipe, "2026-10-09", new Date(), {
        slot: "Snacks",
        servingsMultiplier: 0.5,
      });

      expect(logged).toHaveLength(1);
      expect(logged[0]!.calories).toBe(150);
      expect(logged[0]!.protein).toBe(15);
      expect(logged[0]!.carbs).toBe(10);
      expect(logged[0]!.fat).toBe(2.5);
      expect(logged[0]!.qty).toContain("½ serving");
      expect(logged[0]!.slot).toBe("Snacks");
    });

    it("correctly logs 1½ servings (1.5x) of a recipe", async () => {
      const recipe: SavedFood = {
        id: "rec-1",
        name: "Protein Shake",
        calories: 300,
        protein: 30,
        carbs: 20,
        fat: 5,
        recipe: true,
        servings: 1,
        qty: "1 serving",
        createdAt: new Date().toISOString(),
      };

      const logged = await logSavedMeal(recipe, "2026-10-09", new Date(), {
        slot: "Dinner",
        servingsMultiplier: 1.5,
      });

      expect(logged).toHaveLength(1);
      expect(logged[0]!.calories).toBe(450);
      expect(logged[0]!.protein).toBe(45);
      expect(logged[0]!.carbs).toBe(30);
      expect(logged[0]!.fat).toBe(7.5);
      expect(logged[0]!.qty).toContain("1½ servings");
      expect(logged[0]!.slot).toBe("Dinner");
    });
  });

  describe("Saved item deletion and undo restore", () => {
    it("deletes and restores a saved item cleanly", async () => {
      const food = await addSavedFood("Greek Yogurt", {
        calories: 120,
        protein: 15,
        carbs: 6,
        fat: 2,
      });

      let all = await getSavedFoods();
      expect(all.some((f) => f.id === food.id)).toBe(true);

      await deleteSavedFood(food.id);
      all = await getSavedFoods();
      expect(all.some((f) => f.id === food.id)).toBe(false);

      await restoreSavedFood(food);
      all = await getSavedFoods();
      expect(all.some((f) => f.id === food.id)).toBe(true);
    });
  });

  describe("Creating foods and meals from Kitchen directly", () => {
    it("creates a single food without logging it first", async () => {
      const food = await addSavedFood(
        "Almond Milk",
        { calories: 40, protein: 1, carbs: 2, fat: 3 },
        undefined,
        { qty: "1 cup" },
      );

      expect(food.name).toBe("Almond Milk");
      expect(isSavedMeal(food)).toBe(false);
      expect(food.recipe).toBeUndefined();

      const all = await getSavedFoods();
      expect(all.find((f) => f.id === food.id)).toBeDefined();
    });

    it("creates a multi-item meal without logging it first", async () => {
      const meal = await addSavedFood(
        "Breakfast Combo",
        { calories: 350, protein: 20, carbs: 40, fat: 12 },
        [
          { name: "Eggs", calories: 140, protein: 12, carbs: 1, fat: 10 },
          { name: "Toast", calories: 150, protein: 5, carbs: 28, fat: 2 },
          { name: "Butter", calories: 60, protein: 0, carbs: 0, fat: 7 },
        ],
        { slot: "Breakfast" },
      );

      expect(meal.name).toBe("Breakfast Combo");
      expect(isSavedMeal(meal)).toBe(true);
      expect(meal.foods).toHaveLength(3);

      const logged = await logSavedMeal(meal, "2026-10-09", new Date());
      expect(logged).toHaveLength(3);
      expect(logged[0]!.name).toBe("Eggs");
      expect(logged[1]!.name).toBe("Toast");
      expect(logged[2]!.name).toBe("Butter");
    });
  });
});
