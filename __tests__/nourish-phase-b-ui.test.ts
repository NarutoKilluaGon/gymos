import {
  extractFoodUnit,
  isItemSaved,
  saveMealWithItems,
  getSavedFoods,
  addSavedFood,
  updateSavedFood,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import { setStorage } from "@/storage/storage";
import type { Meal } from "@/types/gymos";

describe("Phase B: Nourish UI, Bookmarking & Saved Meal Upsert", () => {
  beforeEach(async () => {
    // Clear saved foods before each test
    await setStorage("@gymos/saved-foods", []);
  });

  describe("1. extractFoodUnit & isItemSaved", () => {
    it("extracts canonical units from portion strings", () => {
      expect(extractFoodUnit("100 g")).toBe("g");
      expect(extractFoodUnit("150 grams")).toBe("g");
      expect(extractFoodUnit("1 bowl")).toBe("bowl");
      expect(extractFoodUnit("1 katori")).toBe("bowl");
      expect(extractFoodUnit("2 pieces")).toBe("piece");
      expect(extractFoodUnit("1 serving")).toBe("serving");
      expect(extractFoodUnit("250 ml")).toBe("ml");
      expect(extractFoodUnit("1 glass")).toBe("glass");
      expect(extractFoodUnit(undefined)).toBe("");
    });

    it("isItemSaved detects saved items by normalized name and unit", () => {
      const savedFoods: SavedFood[] = [
        {
          id: "s1",
          name: "Roti (phulka)",
          qty: "1 piece",
          calories: 80,
          protein: 3,
          carbs: 15,
          fat: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "s2",
          name: "Dal tadka",
          qty: "1 bowl",
          calories: 170,
          protein: 9,
          carbs: 22,
          fat: 5,
          createdAt: new Date().toISOString(),
        },
        {
          id: "s3_meal",
          name: "Usual lunch",
          foods: [
            { name: "Roti", calories: 80, protein: 3, carbs: 15, fat: 1 },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      // Exact match
      expect(isItemSaved({ name: "Roti (phulka)", qty: "1 piece" }, savedFoods)).toBe(true);
      // Normalized match (case / punctuation / plural)
      expect(isItemSaved({ name: "roti (phulka)", qty: "2 pieces" }, savedFoods)).toBe(true);
      expect(isItemSaved({ name: "Dal Tadka", qty: "1 katori" }, savedFoods)).toBe(true);

      // Different unit
      expect(isItemSaved({ name: "Dal tadka", qty: "100 g" }, savedFoods)).toBe(false);

      // Not saved
      expect(isItemSaved({ name: "Paneer bhurji", qty: "1 plate" }, savedFoods)).toBe(false);

      // Saved meals with foods[] are not considered individual saved food items
      expect(isItemSaved({ name: "Usual lunch" }, savedFoods)).toBe(false);
    });
  });

  describe("2. saveMealWithItems deduplication and preservation", () => {
    it("saves meal and upserts individual items deduped by name+unit", async () => {
      const meals: Meal[] = [
        {
          id: "m1",
          name: "Roti",
          qty: "2 pieces",
          calories: 160,
          protein: 6,
          carbs: 30,
          fat: 2,
          timestamp: "2026-10-14T13:00:00.000Z",
          slot: "Lunch",
        },
        {
          id: "m2",
          name: "Dal tadka",
          qty: "1 bowl",
          calories: 170,
          protein: 9,
          carbs: 22,
          fat: 5,
          timestamp: "2026-10-14T13:05:00.000Z",
          slot: "Lunch",
        },
      ];

      const savedMeal = await saveMealWithItems("My Power Lunch", meals, "Lunch");
      expect(savedMeal).toBeDefined();
      expect(savedMeal?.name).toBe("My Power Lunch");
      expect(savedMeal?.calories).toBe(330);
      expect(savedMeal?.protein).toBe(15);
      expect(savedMeal?.foods?.length).toBe(2);

      const allSaved = await getSavedFoods();
      // Should have 1 saved meal + 2 individual foods = 3 entries
      expect(allSaved.length).toBe(3);

      const savedRoti = allSaved.find((s) => s.name === "Roti");
      expect(savedRoti).toBeDefined();
      expect(savedRoti?.calories).toBe(160);
      expect(savedRoti?.qty).toBe("2 pieces");

      const savedDal = allSaved.find((s) => s.name === "Dal tadka");
      expect(savedDal).toBeDefined();
      expect(savedDal?.calories).toBe(170);
    });

    it("NEVER overwrites user-edited saved foods when saving a meal", async () => {
      // 1. User previously created / edited a custom saved food for "Roti" with 120 kcal
      const customRoti = await addSavedFood("Roti", {
        calories: 120, // Custom user value!
        protein: 4,
        carbs: 20,
        fat: 2,
      }, undefined, { qty: "2 pieces" });

      expect(customRoti.calories).toBe(120);

      // 2. Now user logs an occasion where Roti is 160 kcal, and saves the occasion as a meal
      const meals: Meal[] = [
        {
          id: "m1",
          name: "Roti",
          qty: "2 pieces",
          calories: 160, // Different from custom 120 kcal
          protein: 6,
          carbs: 30,
          fat: 2,
          timestamp: "2026-10-14T13:00:00.000Z",
          slot: "Lunch",
        },
        {
          id: "m2",
          name: "Salad",
          qty: "1 bowl",
          calories: 50,
          protein: 2,
          carbs: 10,
          fat: 0,
          timestamp: "2026-10-14T13:05:00.000Z",
          slot: "Lunch",
        },
      ];

      await saveMealWithItems("Healthy Lunch", meals, "Lunch");

      const allSaved = await getSavedFoods();
      // Find individual Roti
      const individualRotis = allSaved.filter(
        (s) => !s.foods && !s.recipe && s.name.toLowerCase() === "roti",
      );
      // There must be exactly one Roti saved food, and its calories MUST remain 120 (never overwritten!)
      expect(individualRotis.length).toBe(1);
      expect(individualRotis[0]?.calories).toBe(120);
      expect(individualRotis[0]?.id).toBe(customRoti.id);

      // And the new food "Salad" was added
      const salad = allSaved.find((s) => s.name === "Salad");
      expect(salad).toBeDefined();
      expect(salad?.calories).toBe(50);
    });

    it("dedupes repeated items in the same meal so only one individual food is added", async () => {
      const meals: Meal[] = [
        {
          id: "m1",
          name: "Boiled egg",
          qty: "2 pieces",
          calories: 140,
          protein: 12,
          carbs: 1,
          fat: 10,
          timestamp: "2026-10-14T08:00:00.000Z",
          slot: "Breakfast",
        },
        {
          id: "m2",
          name: "Boiled egg",
          qty: "2 pieces",
          calories: 140,
          protein: 12,
          carbs: 1,
          fat: 10,
          timestamp: "2026-10-14T08:05:00.000Z",
          slot: "Breakfast",
        },
      ];

      await saveMealWithItems("Egg breakfast", meals, "Breakfast");

      const allSaved = await getSavedFoods();
      const eggItems = allSaved.filter(
        (s) => !s.foods && !s.recipe && s.name === "Boiled egg",
      );
      // Only 1 individual saved food added, not 2
      expect(eggItems.length).toBe(1);
    });

    it("rolls back on failure so meal and item upserts are all-or-nothing", async () => {
      // Pre-populate with one existing saved food
      const initial = await addSavedFood("Toast", { calories: 80, protein: 3, carbs: 15, fat: 1 });
      const beforeFoods = await getSavedFoods();
      expect(beforeFoods.length).toBe(1);

      const meals: Meal[] = [
        {
          id: "m1",
          name: "Oatmeal",
          qty: "1 bowl",
          calories: 150,
          protein: 5,
          carbs: 27,
          fat: 3,
          timestamp: "2026-10-14T08:00:00.000Z",
          slot: "Breakfast",
        },
      ];

      // Simulate a storage failure during setStorage
      const storageModule = require("@/storage/storage");
      const originalSetStorage = storageModule.setStorage;
      const setStorageSpy = jest.spyOn(storageModule, "setStorage").mockImplementationOnce(() => {
        return Promise.reject(new Error("Disk full or quota exceeded"));
      });

      await expect(saveMealWithItems("Oatmeal breakfast", meals, "Breakfast")).rejects.toThrow(
        "Disk full or quota exceeded",
      );

      // Verify that all-or-nothing rollback left existing saved foods intact
      const afterFoods = await getSavedFoods();
      expect(afterFoods.length).toBe(1);
      expect(afterFoods[0].id).toBe(initial.id);
      expect(afterFoods[0].name).toBe("Toast");

      setStorageSpy.mockRestore();
    });
  });

  describe("3. updateSavedFood", () => {
    it("updates macros and fields of an existing saved food while preserving its id", async () => {
      const initial = await addSavedFood("Roti", {
        calories: 80,
        protein: 3,
        carbs: 15,
        fat: 1,
      }, undefined, { qty: "1 piece" });

      const updated = await updateSavedFood(
        initial.id,
        {
          calories: 100,
          protein: 4,
          qty: "1 large piece",
        },
      );

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(initial.id);
      expect(updated?.calories).toBe(100);
      expect(updated?.protein).toBe(4);
      expect(updated?.qty).toBe("1 large piece");

      const all = await getSavedFoods();
      expect(all.length).toBe(1);
      expect(all[0].calories).toBe(100);
    });
  });
});
