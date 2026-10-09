/**
 * Offline food database (Slice 3A; micronutrients in S1).
 *
 * Static, zero-dependency catalog of common foods with estimated macros
 * per stated portion. Bundled at build time, so search/selection works
 * fully offline. Used for:
 *   - the Add Food sheet search (also serves AddMealSheet's inline
 *     Quick Meals section) + the meal review's food resolver (S6A)
 *
 * All values are rough ESTIMATES for the stated portion, in the same
 * spirit as QUICK_MEALS in meal-estimator.ts — including micronutrients,
 * which are approximate, never laboratory-accurate. Micro units,
 * documented once: fiber g;
 * sodium/potassium/calcium/iron/magnesium/zinc/vitaminC mg;
 * vitaminA/vitaminD/vitaminB12/folate in µg amounts.
 */

import {
  NUTRIENT_KEYS,
  pickMicronutrients,
  type EstimatedFood,
  type Micronutrients,
} from "@/types/gymos";
import type { MealEstimate } from "@/services/meal-estimator";
import type { MacroTotals } from "@/storage/repositories/meals";

/** One catalog food: fixed name, structured portion, macros per portion. */
export type FoodEntry = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} & Micronutrients;

/** Anything with a base portion + macros that can be rescaled by amount. */
export type PortionMacros = {
  amount: number;
} & MacroTotals;

export const FOOD_DATABASE: FoodEntry[] = [
  // ---------- Indian dishes & snacks ----------
  // micros: fiber, sodium, potassium, calcium, iron, magnesium, zinc, vitaminA, vitaminC, vitaminD, vitaminB12, folate
  { id: "masala-dosa", name: "Masala dosa", amount: 1, unit: "piece", calories: 250, protein: 6, carbs: 45, fat: 5, fiber: 2, sodium: 300, potassium: 250, calcium: 30, iron: 1.5, magnesium: 30, zinc: 0.5, vitaminA: 5, vitaminC: 4, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "plain-dosa", name: "Plain dosa", amount: 1, unit: "piece", calories: 170, protein: 4, carbs: 32, fat: 4, fiber: 1, sodium: 200, potassium: 150, calcium: 20, iron: 1, magnesium: 20, zinc: 0.3, vitaminA: 0, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 25 },
  { id: "rava-dosa", name: "Rava dosa", amount: 1, unit: "piece", calories: 230, protein: 5, carbs: 38, fat: 7, fiber: 1.5, sodium: 250, potassium: 180, calcium: 25, iron: 1.2, magnesium: 25, zinc: 0.4, vitaminA: 2, vitaminC: 3, vitaminD: 0, vitaminB12: 0, folate: 30 },
  { id: "idli", name: "Idli", amount: 2, unit: "piece", calories: 140, protein: 5, carbs: 30, fat: 1, fiber: 1, sodium: 150, potassium: 120, calcium: 15, iron: 0.8, magnesium: 18, zinc: 0.3, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 20 },
  { id: "medu-vada", name: "Medu vada", amount: 2, unit: "piece", calories: 190, protein: 6, carbs: 18, fat: 11, fiber: 3, sodium: 250, potassium: 300, calcium: 30, iron: 1.5, magnesium: 40, zinc: 0.5, vitaminA: 0, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 45 },
  { id: "dahi-vada", name: "Dahi vada", amount: 2, unit: "piece", calories: 200, protein: 8, carbs: 30, fat: 6, fiber: 2, sodium: 300, potassium: 350, calcium: 150, iron: 1.2, magnesium: 35, zinc: 0.6, vitaminA: 10, vitaminC: 1, vitaminD: 0, vitaminB12: 0.5, folate: 40 },
  { id: "sambar", name: "Sambar", amount: 150, unit: "ml", calories: 130, protein: 6, carbs: 22, fat: 3, fiber: 3, sodium: 400, potassium: 350, calcium: 40, iron: 1.5, magnesium: 35, zinc: 0.5, vitaminA: 30, vitaminC: 5, vitaminD: 0, vitaminB12: 0, folate: 50 },
  { id: "poha", name: "Poha", amount: 1, unit: "plate", calories: 270, protein: 6, carbs: 50, fat: 6, fiber: 2, sodium: 350, potassium: 300, calcium: 25, iron: 2.5, magnesium: 30, zinc: 0.6, vitaminA: 20, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 30 },
  { id: "upma", name: "Upma", amount: 1, unit: "plate", calories: 250, protein: 7, carbs: 42, fat: 6, fiber: 3, sodium: 350, potassium: 250, calcium: 20, iron: 1.5, magnesium: 35, zinc: 0.6, vitaminA: 15, vitaminC: 3, vitaminD: 0, vitaminB12: 0, folate: 35 },
  { id: "pongal", name: "Ven pongal", amount: 1, unit: "plate", calories: 290, protein: 9, carbs: 48, fat: 7, fiber: 3, sodium: 300, potassium: 300, calcium: 40, iron: 1.8, magnesium: 45, zinc: 0.7, vitaminA: 5, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 45 },
  { id: "aloo-paratha", name: "Aloo paratha", amount: 1, unit: "piece", calories: 200, protein: 5, carbs: 30, fat: 7, fiber: 3, sodium: 250, potassium: 400, calcium: 20, iron: 1.5, magnesium: 30, zinc: 0.5, vitaminA: 2, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 35 },
  { id: "roti", name: "Roti (phulka)", amount: 1, unit: "piece", calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1.5, sodium: 5, potassium: 100, calcium: 10, iron: 0.8, magnesium: 20, zinc: 0.3, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 10 },
  { id: "butter-naan", name: "Butter naan", amount: 1, unit: "piece", calories: 150, protein: 4, carbs: 26, fat: 4, fiber: 1.5, sodium: 200, potassium: 80, calcium: 15, iron: 0.8, magnesium: 12, zinc: 0.3, vitaminA: 15, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 20 },
  { id: "veg-biryani", name: "Veg biryani", amount: 1, unit: "plate", calories: 420, protein: 9, carbs: 70, fat: 12, fiber: 4, sodium: 600, potassium: 500, calcium: 60, iron: 2.5, magnesium: 50, zinc: 0.8, vitaminA: 60, vitaminC: 10, vitaminD: 0, vitaminB12: 0, folate: 50 },
  { id: "chicken-biryani", name: "Chicken biryani", amount: 1, unit: "plate", calories: 550, protein: 28, carbs: 60, fat: 18, fiber: 3, sodium: 700, potassium: 600, calcium: 50, iron: 3, magnesium: 55, zinc: 2.5, vitaminA: 50, vitaminC: 8, vitaminD: 0.2, vitaminB12: 2, folate: 40 },
  { id: "veg-pulao", name: "Veg pulao", amount: 1, unit: "plate", calories: 350, protein: 7, carbs: 58, fat: 10, fiber: 4, sodium: 500, potassium: 450, calcium: 50, iron: 2, magnesium: 45, zinc: 0.7, vitaminA: 80, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 45 },
  { id: "lemon-rice", name: "Lemon rice", amount: 1, unit: "plate", calories: 320, protein: 6, carbs: 58, fat: 8, fiber: 2, sodium: 450, potassium: 300, calcium: 30, iron: 1.5, magnesium: 35, zinc: 0.5, vitaminA: 10, vitaminC: 6, vitaminD: 0, vitaminB12: 0, folate: 35 },
  { id: "curd-rice", name: "Curd rice", amount: 1, unit: "plate", calories: 300, protein: 10, carbs: 50, fat: 6, fiber: 1, sodium: 350, potassium: 400, calcium: 200, iron: 1, magnesium: 35, zinc: 0.8, vitaminA: 15, vitaminC: 2, vitaminD: 0, vitaminB12: 1, folate: 30 },
  { id: "khichdi", name: "Khichdi", amount: 1, unit: "plate", calories: 320, protein: 12, carbs: 55, fat: 6, fiber: 4, sodium: 450, potassium: 450, calcium: 50, iron: 2.5, magnesium: 55, zinc: 0.8, vitaminA: 40, vitaminC: 4, vitaminD: 0, vitaminB12: 0, folate: 60 },
  { id: "dal-tadka", name: "Dal tadka", amount: 150, unit: "ml", calories: 170, protein: 9, carbs: 24, fat: 5, fiber: 4, sodium: 400, potassium: 400, calcium: 30, iron: 2, magnesium: 40, zinc: 0.6, vitaminA: 10, vitaminC: 2, vitaminD: 0, vitaminB12: 0, folate: 70 },
  { id: "chole-masala", name: "Chole masala", amount: 150, unit: "g", calories: 220, protein: 10, carbs: 30, fat: 7, fiber: 6, sodium: 450, potassium: 400, calcium: 60, iron: 3, magnesium: 45, zinc: 1, vitaminA: 15, vitaminC: 3, vitaminD: 0, vitaminB12: 0, folate: 90 },
  { id: "rajma", name: "Rajma", amount: 150, unit: "g", calories: 210, protein: 11, carbs: 32, fat: 4, fiber: 6, sodium: 400, potassium: 550, calcium: 60, iron: 3.5, magnesium: 55, zinc: 1, vitaminA: 5, vitaminC: 2, vitaminD: 0, vitaminB12: 0, folate: 100 },
  { id: "palak-paneer", name: "Palak paneer", amount: 150, unit: "g", calories: 240, protein: 11, carbs: 10, fat: 18, fiber: 3, sodium: 450, potassium: 600, calcium: 350, iron: 3, magnesium: 70, zinc: 1, vitaminA: 400, vitaminC: 15, vitaminD: 0, vitaminB12: 0.3, folate: 60 },
  { id: "paneer-butter-masala", name: "Paneer butter masala", amount: 150, unit: "g", calories: 320, protein: 12, carbs: 12, fat: 26, fiber: 2, sodium: 500, potassium: 350, calcium: 300, iron: 1.5, magnesium: 30, zinc: 1.2, vitaminA: 250, vitaminC: 6, vitaminD: 0.1, vitaminB12: 0.5, folate: 25 },
  { id: "chicken-curry", name: "Chicken curry", amount: 150, unit: "g", calories: 280, protein: 24, carbs: 10, fat: 16, fiber: 1, sodium: 500, potassium: 400, calcium: 30, iron: 2, magnesium: 30, zinc: 2, vitaminA: 40, vitaminC: 4, vitaminD: 0.1, vitaminB12: 1.5, folate: 15 },
  { id: "egg-curry", name: "Egg curry", amount: 150, unit: "g", calories: 250, protein: 13, carbs: 8, fat: 18, fiber: 1, sodium: 450, potassium: 350, calcium: 60, iron: 2.5, magnesium: 25, zinc: 1.5, vitaminA: 150, vitaminC: 3, vitaminD: 1.5, vitaminB12: 1.2, folate: 30 },
  { id: "egg-bhurji", name: "Egg bhurji", amount: 1, unit: "plate", calories: 220, protein: 13, carbs: 6, fat: 16, fiber: 1, sodium: 400, potassium: 350, calcium: 60, iron: 2.5, magnesium: 25, zinc: 1.5, vitaminA: 160, vitaminC: 4, vitaminD: 1.8, vitaminB12: 1.2, folate: 35 },
  { id: "pav-bhaji", name: "Pav bhaji", amount: 1, unit: "plate", calories: 400, protein: 10, carbs: 60, fat: 14, fiber: 6, sodium: 700, potassium: 800, calcium: 80, iron: 2.5, magnesium: 50, zinc: 0.8, vitaminA: 300, vitaminC: 20, vitaminD: 0, vitaminB12: 0, folate: 60 },
  { id: "misal-pav", name: "Misal pav", amount: 1, unit: "plate", calories: 380, protein: 14, carbs: 55, fat: 12, fiber: 7, sodium: 800, potassium: 700, calcium: 90, iron: 3.5, magnesium: 60, zinc: 1.2, vitaminA: 100, vitaminC: 10, vitaminD: 0, vitaminB12: 0, folate: 80 },
  { id: "vada-pav", name: "Vada pav", amount: 1, unit: "piece", calories: 290, protein: 7, carbs: 40, fat: 12, fiber: 3, sodium: 450, potassium: 500, calcium: 30, iron: 1.8, magnesium: 30, zinc: 0.5, vitaminA: 5, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "samosa", name: "Samosa", amount: 1, unit: "piece", calories: 260, protein: 5, carbs: 30, fat: 14, fiber: 2, sodium: 300, potassium: 300, calcium: 20, iron: 1.2, magnesium: 20, zinc: 0.4, vitaminA: 5, vitaminC: 5, vitaminD: 0, vitaminB12: 0, folate: 25 },
  { id: "veg-pakora", name: "Veg pakora", amount: 5, unit: "piece", calories: 220, protein: 6, carbs: 22, fat: 13, fiber: 3, sodium: 350, potassium: 400, calcium: 40, iron: 1.5, magnesium: 35, zinc: 0.5, vitaminA: 30, vitaminC: 6, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "bhel-puri", name: "Bhel puri", amount: 1, unit: "plate", calories: 200, protein: 5, carbs: 38, fat: 4, fiber: 3, sodium: 500, potassium: 350, calcium: 30, iron: 1.5, magnesium: 35, zinc: 0.6, vitaminA: 20, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 35 },
  { id: "pani-puri", name: "Pani puri", amount: 6, unit: "piece", calories: 180, protein: 4, carbs: 32, fat: 5, fiber: 2, sodium: 450, potassium: 300, calcium: 25, iron: 1.5, magnesium: 30, zinc: 0.5, vitaminA: 15, vitaminC: 6, vitaminD: 0, vitaminB12: 0, folate: 30 },
  // ---------- Staples ----------
  { id: "steamed-rice", name: "Steamed rice", amount: 1, unit: "cup", calories: 205, protein: 4, carbs: 45, fat: 0, fiber: 0.5, sodium: 5, potassium: 50, calcium: 15, iron: 0.3, magnesium: 18, zinc: 0.2, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 8 },
  { id: "cooked-rice", name: "Cooked rice", amount: 100, unit: "g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.3, sodium: 3, potassium: 32, calcium: 10, iron: 0.2, magnesium: 11, zinc: 0.1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 5 },
  { id: "wheat-flour", name: "Whole wheat flour (atta)", amount: 100, unit: "g", calories: 340, protein: 13, carbs: 72, fat: 2, fiber: 11, sodium: 5, potassium: 340, calcium: 35, iron: 3.5, magnesium: 140, zinc: 2.5, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "basmati-dry", name: "Basmati rice (dry)", amount: 100, unit: "g", calories: 360, protein: 7, carbs: 78, fat: 1, fiber: 1, sodium: 5, potassium: 115, calcium: 30, iron: 0.5, magnesium: 25, zinc: 1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 8 },
  { id: "toor-dal-dry", name: "Toor dal (dry)", amount: 100, unit: "g", calories: 340, protein: 22, carbs: 63, fat: 1, fiber: 15, sodium: 15, potassium: 1400, calcium: 130, iron: 5, magnesium: 180, zinc: 2.5, vitaminA: 10, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 450 },
  { id: "oats", name: "Oats", amount: 40, unit: "g", calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sodium: 2, potassium: 170, calcium: 20, iron: 1.7, magnesium: 55, zinc: 1.6, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 22 },
  { id: "whole-wheat-bread", name: "Whole wheat bread", amount: 2, unit: "slice", calories: 140, protein: 5, carbs: 26, fat: 2, fiber: 4, sodium: 280, potassium: 150, calcium: 60, iron: 1.5, magnesium: 45, zinc: 1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 30 },
  { id: "pav", name: "Pav", amount: 2, unit: "piece", calories: 280, protein: 8, carbs: 54, fat: 4, fiber: 2, sodium: 350, potassium: 90, calcium: 60, iron: 1.8, magnesium: 15, zinc: 0.5, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 45 },
  { id: "cooked-noodles", name: "Cooked noodles", amount: 1, unit: "cup", calories: 220, protein: 4, carbs: 40, fat: 3, fiber: 2, sodium: 300, potassium: 60, calcium: 10, iron: 1, magnesium: 20, zinc: 0.4, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 60 },
  // ---------- Dairy ----------
  { id: "toned-milk", name: "Toned milk", amount: 250, unit: "ml", calories: 150, protein: 8, carbs: 12, fat: 8, fiber: 0, sodium: 110, potassium: 350, calcium: 280, iron: 0.1, magnesium: 25, zinc: 1, vitaminA: 70, vitaminC: 2, vitaminD: 0.1, vitaminB12: 1.2, folate: 12 },
  { id: "curd", name: "Curd", amount: 200, unit: "g", calories: 120, protein: 7, carbs: 9, fat: 4, fiber: 0, sodium: 90, potassium: 280, calcium: 220, iron: 0.1, magnesium: 22, zinc: 0.8, vitaminA: 20, vitaminC: 1, vitaminD: 0, vitaminB12: 0.7, folate: 14 },
  { id: "paneer", name: "Paneer", amount: 100, unit: "g", calories: 265, protein: 18, carbs: 4, fat: 20, fiber: 0, sodium: 20, potassium: 100, calcium: 480, iron: 0.2, magnesium: 20, zinc: 1.2, vitaminA: 90, vitaminC: 0, vitaminD: 0, vitaminB12: 0.8, folate: 10 },
  { id: "ghee", name: "Ghee", amount: 1, unit: "tbsp", calories: 135, protein: 0, carbs: 0, fat: 15, fiber: 0, sodium: 0, potassium: 5, calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitaminA: 100, vitaminC: 0, vitaminD: 0.2, vitaminB12: 0, folate: 0 },
  { id: "butter", name: "Butter", amount: 1, unit: "tbsp", calories: 100, protein: 0, carbs: 0, fat: 11, fiber: 0, sodium: 90, potassium: 5, calcium: 5, iron: 0, magnesium: 0, zinc: 0, vitaminA: 100, vitaminC: 0, vitaminD: 0.1, vitaminB12: 0, folate: 0 },
  { id: "buttermilk", name: "Buttermilk (chaas)", amount: 250, unit: "ml", calories: 40, protein: 3, carbs: 5, fat: 1, fiber: 0, sodium: 150, potassium: 350, calcium: 280, iron: 0.1, magnesium: 25, zinc: 1, vitaminA: 20, vitaminC: 2, vitaminD: 0, vitaminB12: 1, folate: 12 },
  { id: "cheese-slice", name: "Cheese slice", amount: 1, unit: "piece", calories: 70, protein: 4, carbs: 1, fat: 6, fiber: 0, sodium: 180, potassium: 30, calcium: 150, iron: 0.1, magnesium: 8, zinc: 0.6, vitaminA: 50, vitaminC: 0, vitaminD: 0.1, vitaminB12: 0.3, folate: 2 },
  { id: "greek-yogurt", name: "Greek yogurt", amount: 200, unit: "g", calories: 140, protein: 20, carbs: 7, fat: 3, fiber: 0, sodium: 70, potassium: 280, calcium: 220, iron: 0.1, magnesium: 22, zinc: 1, vitaminA: 10, vitaminC: 1, vitaminD: 0, vitaminB12: 1.5, folate: 14 },
  // ---------- Eggs ----------
  { id: "boiled-egg", name: "Boiled egg", amount: 1, unit: "piece", calories: 70, protein: 6, carbs: 1, fat: 5, fiber: 0, sodium: 70, potassium: 70, calcium: 25, iron: 0.9, magnesium: 6, zinc: 0.6, vitaminA: 80, vitaminC: 0, vitaminD: 1, vitaminB12: 0.6, folate: 24 },
  { id: "omelette", name: "Omelette (2 eggs)", amount: 1, unit: "serving", calories: 180, protein: 12, carbs: 2, fat: 14, fiber: 0, sodium: 250, potassium: 200, calcium: 60, iron: 2, magnesium: 15, zinc: 1.3, vitaminA: 180, vitaminC: 1, vitaminD: 2, vitaminB12: 1.2, folate: 55 },
  { id: "fried-egg", name: "Fried egg", amount: 1, unit: "piece", calories: 90, protein: 6, carbs: 1, fat: 7, fiber: 0, sodium: 200, potassium: 80, calcium: 30, iron: 1, magnesium: 7, zinc: 0.6, vitaminA: 90, vitaminC: 0, vitaminD: 1.1, vitaminB12: 0.6, folate: 25 },
  // ---------- Fruits ----------
  { id: "banana", name: "Banana", amount: 1, unit: "piece", calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, sodium: 1, potassium: 420, calcium: 6, iron: 0.3, magnesium: 32, zinc: 0.2, vitaminA: 4, vitaminC: 10, vitaminD: 0, vitaminB12: 0, folate: 24 },
  { id: "apple", name: "Apple", amount: 1, unit: "piece", calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sodium: 2, potassium: 190, calcium: 10, iron: 0.2, magnesium: 9, zinc: 0.1, vitaminA: 5, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 5 },
  { id: "mango", name: "Mango", amount: 1, unit: "cup", calories: 100, protein: 1, carbs: 25, fat: 1, fiber: 2.5, sodium: 2, potassium: 280, calcium: 18, iron: 0.3, magnesium: 17, zinc: 0.1, vitaminA: 90, vitaminC: 60, vitaminD: 0, vitaminB12: 0, folate: 70 },
  { id: "orange", name: "Orange", amount: 1, unit: "piece", calories: 60, protein: 1, carbs: 15, fat: 0, fiber: 2.5, sodium: 0, potassium: 240, calcium: 50, iron: 0.1, magnesium: 13, zinc: 0.1, vitaminA: 15, vitaminC: 70, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "papaya", name: "Papaya", amount: 1, unit: "cup", calories: 55, protein: 1, carbs: 14, fat: 0, fiber: 2.5, sodium: 12, potassium: 260, calcium: 30, iron: 0.4, magnesium: 30, zinc: 0.1, vitaminA: 70, vitaminC: 90, vitaminD: 0, vitaminB12: 0, folate: 55 },
  { id: "watermelon", name: "Watermelon", amount: 1, unit: "cup", calories: 45, protein: 1, carbs: 11, fat: 0, fiber: 0.5, sodium: 2, potassium: 170, calcium: 10, iron: 0.4, magnesium: 15, zinc: 0.1, vitaminA: 40, vitaminC: 12, vitaminD: 0, vitaminB12: 0, folate: 5 },
  { id: "grapes", name: "Grapes", amount: 1, unit: "cup", calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 1.5, sodium: 3, potassium: 290, calcium: 20, iron: 0.5, magnesium: 10, zinc: 0.1, vitaminA: 5, vitaminC: 5, vitaminD: 0, vitaminB12: 0, folate: 3 },
  { id: "pomegranate", name: "Pomegranate", amount: 1, unit: "cup", calories: 145, protein: 3, carbs: 33, fat: 2, fiber: 7, sodium: 5, potassium: 410, calcium: 18, iron: 0.5, magnesium: 20, zinc: 0.6, vitaminA: 0, vitaminC: 30, vitaminD: 0, vitaminB12: 0, folate: 65 },
  { id: "guava", name: "Guava", amount: 1, unit: "piece", calories: 70, protein: 3, carbs: 14, fat: 1, fiber: 5, sodium: 2, potassium: 420, calcium: 18, iron: 0.3, magnesium: 22, zinc: 0.2, vitaminA: 30, vitaminC: 230, vitaminD: 0, vitaminB12: 0, folate: 50 },
  { id: "coconut-water", name: "Coconut water", amount: 250, unit: "ml", calories: 45, protein: 1, carbs: 9, fat: 0, fiber: 0, sodium: 250, potassium: 600, calcium: 60, iron: 0.7, magnesium: 60, zinc: 0.3, vitaminA: 0, vitaminC: 6, vitaminD: 0, vitaminB12: 0, folate: 8 },
  // ---------- Chutneys & sauces ----------
  { id: "coconut-chutney", name: "Coconut chutney", amount: 2, unit: "tbsp", calories: 90, protein: 1, carbs: 3, fat: 9, fiber: 2, sodium: 150, potassium: 150, calcium: 10, iron: 0.5, magnesium: 15, zinc: 0.2, vitaminA: 0, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 8 },
  { id: "mint-chutney", name: "Mint chutney", amount: 2, unit: "tbsp", calories: 25, protein: 1, carbs: 5, fat: 0, fiber: 1, sodium: 200, potassium: 150, calcium: 60, iron: 1.5, magnesium: 20, zinc: 0.2, vitaminA: 120, vitaminC: 8, vitaminD: 0, vitaminB12: 0, folate: 30 },
  { id: "tamarind-chutney", name: "Tamarind chutney", amount: 2, unit: "tbsp", calories: 110, protein: 0, carbs: 28, fat: 0, fiber: 1, sodium: 100, potassium: 250, calcium: 30, iron: 1, magnesium: 35, zinc: 0.1, vitaminA: 2, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 5 },
  { id: "tomato-ketchup", name: "Tomato ketchup", amount: 1, unit: "tbsp", calories: 20, protein: 0, carbs: 5, fat: 0, fiber: 0.2, sodium: 150, potassium: 60, calcium: 3, iron: 0.1, magnesium: 3, zinc: 0, vitaminA: 7, vitaminC: 2, vitaminD: 0, vitaminB12: 0, folate: 2 },
  { id: "mango-pickle", name: "Mango pickle", amount: 1, unit: "tbsp", calories: 35, protein: 0, carbs: 4, fat: 2, fiber: 0.5, sodium: 600, potassium: 40, calcium: 10, iron: 0.2, magnesium: 5, zinc: 0, vitaminA: 10, vitaminC: 3, vitaminD: 0, vitaminB12: 0, folate: 8 },
  { id: "peanut-chutney", name: "Peanut chutney", amount: 2, unit: "tbsp", calories: 120, protein: 4, carbs: 5, fat: 11, fiber: 2, sodium: 200, potassium: 200, calcium: 20, iron: 0.7, magnesium: 50, zinc: 1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 40 },
  { id: "podi", name: "Gunpowder (podi)", amount: 1, unit: "tbsp", calories: 60, protein: 2, carbs: 4, fat: 4, fiber: 1.5, sodium: 150, potassium: 100, calcium: 40, iron: 0.8, magnesium: 25, zinc: 0.3, vitaminA: 5, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 15 },
  // ---------- Cooking ingredients ----------
  { id: "cooking-oil", name: "Cooking oil", amount: 1, unit: "tbsp", calories: 120, protein: 0, carbs: 0, fat: 14, fiber: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 0 },
  { id: "sugar", name: "Sugar", amount: 1, unit: "tsp", calories: 16, protein: 0, carbs: 4, fat: 0, fiber: 0, sodium: 0, potassium: 1, calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 0 },
  { id: "jaggery", name: "Jaggery", amount: 1, unit: "tbsp", calories: 55, protein: 0, carbs: 14, fat: 0, fiber: 0, sodium: 5, potassium: 20, calcium: 12, iron: 0.4, magnesium: 2, zinc: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 1 },
  { id: "honey", name: "Honey", amount: 1, unit: "tbsp", calories: 60, protein: 0, carbs: 17, fat: 0, fiber: 0, sodium: 1, potassium: 10, calcium: 1, iron: 0.1, magnesium: 0, zinc: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 0 },
  { id: "grated-coconut", name: "Grated coconut", amount: 2, unit: "tbsp", calories: 70, protein: 1, carbs: 2, fat: 7, fiber: 1, sodium: 2, potassium: 40, calcium: 2, iron: 0.3, magnesium: 4, zinc: 0.1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 3 },
  { id: "roasted-peanuts", name: "Roasted peanuts", amount: 30, unit: "g", calories: 170, protein: 8, carbs: 5, fat: 15, fiber: 2.5, sodium: 5, potassium: 210, calcium: 28, iron: 1.4, magnesium: 50, zinc: 1, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 72 },
  { id: "cashews", name: "Cashews", amount: 30, unit: "g", calories: 170, protein: 5, carbs: 9, fat: 14, fiber: 1, sodium: 4, potassium: 200, calcium: 11, iron: 2, magnesium: 88, zinc: 1.7, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 8 },
  { id: "milk-powder", name: "Milk powder", amount: 2, unit: "tbsp", calories: 80, protein: 5, carbs: 8, fat: 3, fiber: 0, sodium: 60, potassium: 270, calcium: 150, iron: 0.1, magnesium: 14, zinc: 0.5, vitaminA: 20, vitaminC: 1, vitaminD: 0.1, vitaminB12: 0.5, folate: 6 },
  // ---------- Beverages ----------
  { id: "filter-coffee", name: "Filter coffee (milk + sugar)", amount: 150, unit: "ml", calories: 60, protein: 3, carbs: 8, fat: 2, fiber: 0, sodium: 60, potassium: 200, calcium: 170, iron: 0.1, magnesium: 15, zinc: 0.6, vitaminA: 40, vitaminC: 1, vitaminD: 0, vitaminB12: 0.7, folate: 7 },
  { id: "masala-chai", name: "Masala chai", amount: 150, unit: "ml", calories: 70, protein: 3, carbs: 10, fat: 2, fiber: 0, sodium: 60, potassium: 200, calcium: 170, iron: 0.3, magnesium: 15, zinc: 0.6, vitaminA: 40, vitaminC: 1, vitaminD: 0, vitaminB12: 0.7, folate: 7 },
  { id: "sweet-lassi", name: "Sweet lassi", amount: 250, unit: "ml", calories: 180, protein: 7, carbs: 28, fat: 5, fiber: 0, sodium: 100, potassium: 350, calcium: 250, iron: 0.1, magnesium: 28, zinc: 1, vitaminA: 25, vitaminC: 1, vitaminD: 0, vitaminB12: 0.9, folate: 16 },
];

/** Case-insensitive substring search over entry names. Empty query
 *  returns the full catalog (same semantics as searchQuickMeals). */
export function searchFoods(query: string): FoodEntry[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return FOOD_DATABASE;
  }

  return FOOD_DATABASE.filter((entry) =>
    entry.name.toLowerCase().includes(q),
  );
}

export function getFoodEntry(id: string): FoodEntry | undefined {
  return FOOD_DATABASE.find((entry) => entry.id === id);
}

/** Normalized for matching: lowercase, punctuation → spaces, collapsed,
 *  then plural-insensitive (trailing "s" stripped from longer words).
 *  Singularization applies symmetrically to queries and entry names, so
 *  existing exact matches ("Oats" ↔ "oats") keep working while plural
 *  variants ("eggs", "omelettes", "2 cups") also resolve. Exported so
 *  saved-food matching uses identical normalization (one rule). */
export function normalizeFoodName(value: string): string {
  const collapsed = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return collapsed
    .split(" ")
    .map((word) =>
      word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
        ? word.slice(0, -1)
        : word,
    )
    .join(" ");
}

/**
 * Full-name synonyms for everyday variants the catalog names differently.
 * Keys and values are natural spellings; both sides pass through
 * `normalizeFoodName` at lookup so plural/case forms match too. Only
 * full-string equality fires — partial names never alias, so a dish that
 * merely contains a catalog name ("homemade paneer curry") stays
 * unresolved instead of collapsing to an ingredient.
 */
const FOOD_NAME_ALIASES: Record<string, string> = {
  yogurt: "Curd",
  yoghurt: "Curd",
  dahi: "Curd",
  egg: "Boiled egg",
  omelette: "Omelette (2 eggs)",
  "egg omelette": "Omelette (2 eggs)",
  roti: "Roti (phulka)",
};

/** Apply the alias table to an already-normalized name, if present. */
function resolveFoodAlias(normalized: string): string {
  const target = FOOD_NAME_ALIASES[normalized];

  return target ? normalizeFoodName(target) : normalized;
}

/**
 * Match a parsed food name to a catalog entry: exact normalized match
 * first, then substring candidates — an entry name contained in the food
 * name beats a partial overlap, the longest entry name wins ties, catalog
 * order breaks the rest. Deterministic; returns undefined when nothing is
 * suitable (the caller marks the food unresolved for manual entry).
 *
 * `minScore` filters candidates by match confidence: 1 = any overlap,
 * 2 = the typed text contains the whole entry name, 3 = exact normalized
 * match only (used by local resolution so a user-stated food is never
 * silently swapped for a near-name).
 */
export function matchFoodEntry(
  foodName: string,
  minScore = 1,
): FoodEntry | undefined {
  const raw = normalizeFoodName(foodName);

  if (!raw) {
    return undefined;
  }

  // Everyday variants resolve to their catalog spelling before scoring
  // ("yogurt" → "curd"); dishes that merely contain a catalog name do
  // not alias and stay subject to the minScore confidence bar.
  const q = resolveFoodAlias(raw);

  const scored: {
    entry: FoodEntry;
    score: number;
    length: number;
    index: number;
  }[] = [];

  FOOD_DATABASE.forEach((entry, index) => {
    const name = normalizeFoodName(entry.name);

    let score = 0;
    if (name === q) {
      score = 3;
    } else if (q.includes(name)) {
      score = 2;
    } else if (name.includes(q)) {
      score = 1;
    }

    if (score >= minScore) {
      scored.push({ entry, score, length: name.length, index });
    }
  });

  scored.sort(
    (a, b) =>
      b.score - a.score || b.length - a.length || a.index - b.index,
  );

  return scored[0]?.entry;
}

/**
 * Units match when they name the same unit: case/space/punctuation
 * insensitive, plural-insensitive ("cups" ↔ "cup", "pieces" ↔ "piece"),
 * and across common abbreviation spellings ("tablespoon" ↔ "tbsp",
 * "gm"/"gram" ↔ "g"). Anything else counts as incompatible, so the
 * caller marks the food unresolved instead of scaling across units it
 * cannot convert. Explicit closed vocabulary — unknown words never match.
 */
const UNIT_ALIASES: Record<string, string> = {
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tsps: "tsp",
  gram: "g",
  grams: "g",
  gm: "g",
  gms: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  kg: "kg",
  kgs: "kg",
  milligram: "mg",
  milligrams: "mg",
  mg: "mg",
  millilitre: "ml",
  milliliter: "ml",
  millilitres: "ml",
  milliliters: "ml",
  ml: "ml",
  litre: "l",
  liter: "l",
  litres: "l",
  liters: "l",
  l: "l",
  cup: "cup",
  cups: "cup",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  slice: "slice",
  slices: "slice",
  serving: "serving",
  servings: "serving",
  plate: "plate",
  plates: "plate",
  bowl: "bowl",
  bowls: "bowl",
  clove: "clove",
  cloves: "clove",
  katori: "bowl",
  katoris: "bowl",
  glass: "glass",
  glasses: "glass",
  sprig: "sprig",
  sprigs: "sprig",
  pinch: "pinch",
  pinches: "pinch",
  handful: "handful",
  handfuls: "handful",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
};

export function isSameUnit(a: string, b: string): boolean {
  const normalize = (value: string): string => {
    const letters = value.toLowerCase().replace(/[^a-z]/g, "");

    if (!letters) {
      return "";
    }

    return UNIT_ALIASES[letters] ?? letters;
  };

  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  return normalizedA !== "" && normalizedA === normalizedB;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Rescale a base portion's macros to a different amount (e.g. Ghee
 * 1 tbsp → 2 tbsp doubles every macro). Non-positive or non-finite
 * amounts contribute zero — matching the sheet's blank-counts-as-0 rule.
 * Iterates the canonical NUTRIENT_KEYS so micros scale with macros.
 */
export function scalePortionMacros(
  base: PortionMacros,
  amount: number,
): MacroTotals {
  const ratio =
    base.amount > 0 &&
    Number.isFinite(amount) &&
    amount > 0
      ? amount / base.amount
      : 0;

  const scaled: MacroTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  for (const key of NUTRIENT_KEYS) {
    scaled[key] = round2((base[key] ?? 0) * ratio);
  }

  return scaled;
}

/** Wrap one catalog entry as a single-food estimate so manual picks flow
 *  through the existing MealEstimate → MealSheet review → save pipeline.
 *  Carries the catalog id (S6A) so amount edits can rescale later. */
export function foodEntryToEstimate(entry: FoodEntry): MealEstimate {
  const food: EstimatedFood = {
    name: entry.name,
    estimatedAmount: entry.amount,
    unit: entry.unit,
    entryId: entry.id,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    ...pickMicronutrients(entry),
    nutritionSource: "food-db",
  };

  return {
    foods: [food],
    totals: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      ...pickMicronutrients(food),
    },
  };
}
