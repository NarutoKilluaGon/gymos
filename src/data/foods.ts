/* Sourced from IFCT (Indian Food Composition Tables, ICMR-NIN 2017) and USDA FoodData Central. */

export type FoodDefinition = {
  id: string;
  name: string;
  aliases: string[];
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  pieceG?: number;
  cupG?: number;
  tbspG?: number;
  tspG?: number;
  katoriG?: number;
  glassG?: number;
  cloveG?: number;
  sliceG?: number;
  handfulG?: number;
  pinchG?: number;
  isZeroCalorie?: boolean;
};

export const FOOD_DEFINITIONS: readonly FoodDefinition[] = [
  // ---------- Vegetables & Aromatics ----------
  {
    id: "onion",
    name: "Onion",
    aliases: ["onion", "onions", "pyaz", "red onion", "yellow onion", "white onion"],
    caloriesPer100g: 40,
    proteinPer100g: 1.1,
    carbsPer100g: 9.3,
    fatPer100g: 0.1,
    pieceG: 100,
    cupG: 160,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "tomato",
    name: "Tomato",
    aliases: ["tomato", "tomatoes", "tamatar"],
    caloriesPer100g: 18,
    proteinPer100g: 0.9,
    carbsPer100g: 3.9,
    fatPer100g: 0.2,
    pieceG: 90,
    cupG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "potato",
    name: "Potato",
    aliases: ["potato", "potatoes", "aloo"],
    caloriesPer100g: 77,
    proteinPer100g: 2.0,
    carbsPer100g: 17.5,
    fatPer100g: 0.1,
    pieceG: 150,
    cupG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "garlic",
    name: "Garlic",
    aliases: ["garlic", "garlic clove", "garlic cloves", "lahsun"],
    caloriesPer100g: 149,
    proteinPer100g: 6.4,
    carbsPer100g: 33.0,
    fatPer100g: 0.5,
    cloveG: 3,
    pieceG: 3,
    tspG: 3,
    tbspG: 9,
  },
  {
    id: "green_chilli",
    name: "Green chilli",
    aliases: ["green chilli", "green chillies", "green chili", "green chilies", "hari mirch"],
    caloriesPer100g: 40,
    proteinPer100g: 2.0,
    carbsPer100g: 8.8,
    fatPer100g: 0.2,
    pieceG: 5,
    tspG: 5,
    tbspG: 15,
  },
  {
    id: "capsicum",
    name: "Capsicum",
    aliases: ["capsicum", "bell pepper", "green bell pepper", "shimla mirch"],
    caloriesPer100g: 20,
    proteinPer100g: 0.9,
    carbsPer100g: 4.6,
    fatPer100g: 0.2,
    pieceG: 120,
    cupG: 100,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "carrot",
    name: "Carrot",
    aliases: ["carrot", "carrots", "gajar"],
    caloriesPer100g: 41,
    proteinPer100g: 0.9,
    carbsPer100g: 9.6,
    fatPer100g: 0.2,
    pieceG: 70,
    cupG: 120,
    tbspG: 12,
    tspG: 4,
  },
  {
    id: "spinach",
    name: "Spinach",
    aliases: ["spinach", "palak"],
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    pieceG: 30,
    cupG: 30,
    tbspG: 8,
    tspG: 3,
  },
  {
    id: "cauliflower",
    name: "Cauliflower",
    aliases: ["cauliflower", "gobi", "phool gobi"],
    caloriesPer100g: 25,
    proteinPer100g: 1.9,
    carbsPer100g: 5.0,
    fatPer100g: 0.3,
    pieceG: 400,
    cupG: 100,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "ginger",
    name: "Ginger",
    aliases: ["ginger", "adrak"],
    caloriesPer100g: 80,
    proteinPer100g: 1.8,
    carbsPer100g: 17.8,
    fatPer100g: 0.8,
    pieceG: 10,
    tspG: 3,
    tbspG: 9,
  },

  // ---------- Legumes & Pulses (Raw vs Cooked explicit) ----------
  {
    id: "rajma_cooked",
    name: "Rajma (cooked)",
    aliases: ["rajma", "cooked rajma", "rajma cooked", "kidney beans", "cooked kidney beans", "red kidney beans"],
    caloriesPer100g: 140,
    proteinPer100g: 9.0,
    carbsPer100g: 22.8,
    fatPer100g: 0.5,
    cupG: 180,
    katoriG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "rajma_raw",
    name: "Rajma (raw)",
    aliases: ["dry rajma", "raw rajma", "raw kidney beans"],
    caloriesPer100g: 333,
    proteinPer100g: 23.6,
    carbsPer100g: 60.0,
    fatPer100g: 0.8,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "chana_cooked",
    name: "Chana (cooked)",
    aliases: ["chana", "boiled chana", "cooked chickpeas", "chickpeas", "chole"],
    caloriesPer100g: 164,
    proteinPer100g: 8.9,
    carbsPer100g: 27.4,
    fatPer100g: 2.6,
    cupG: 165,
    katoriG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "chana_raw",
    name: "Chana (raw)",
    aliases: ["raw chana", "dry chickpeas", "raw chickpeas"],
    caloriesPer100g: 364,
    proteinPer100g: 19.3,
    carbsPer100g: 60.6,
    fatPer100g: 6.0,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "moong_raw",
    name: "Moong dal (raw)",
    aliases: ["moong dal", "mung dal", "raw moong dal", "yellow moong dal"],
    caloriesPer100g: 347,
    proteinPer100g: 24.0,
    carbsPer100g: 60.0,
    fatPer100g: 1.2,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "toor_raw",
    name: "Toor dal (raw)",
    aliases: ["toor dal", "arhar dal", "raw toor dal", "split pigeon peas"],
    caloriesPer100g: 343,
    proteinPer100g: 22.0,
    carbsPer100g: 63.0,
    fatPer100g: 1.5,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "masoor_raw",
    name: "Masoor dal (raw)",
    aliases: ["masoor dal", "red lentils", "raw masoor dal"],
    caloriesPer100g: 340,
    proteinPer100g: 25.0,
    carbsPer100g: 60.0,
    fatPer100g: 1.0,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "dal_cooked",
    name: "Dal (cooked)",
    aliases: ["dal", "cooked dal", "daal", "yellow dal", "dal fry", "dal tadka"],
    caloriesPer100g: 100,
    proteinPer100g: 6.0,
    carbsPer100g: 15.0,
    fatPer100g: 2.5,
    katoriG: 150,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "besan",
    name: "Besan",
    aliases: ["besan", "gram flour", "chickpea flour"],
    caloriesPer100g: 387,
    proteinPer100g: 22.4,
    carbsPer100g: 57.8,
    fatPer100g: 6.7,
    cupG: 120,
    tbspG: 10,
    tspG: 3,
  },

  // ---------- Grains & Flours (Raw vs Cooked explicit) ----------
  {
    id: "atta",
    name: "Atta",
    aliases: ["atta", "whole wheat flour", "wheat flour", "gehu ka atta"],
    caloriesPer100g: 340,
    proteinPer100g: 13.0,
    carbsPer100g: 72.0,
    fatPer100g: 2.0,
    cupG: 120,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "rice_cooked",
    name: "Rice (cooked)",
    aliases: ["rice", "cooked rice", "white rice", "chawal", "steamed rice"],
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    cupG: 158,
    katoriG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "rice_raw",
    name: "Rice (raw)",
    aliases: ["raw rice", "dry rice", "uncooked rice", "basmati rice raw"],
    caloriesPer100g: 360,
    proteinPer100g: 7.0,
    carbsPer100g: 78.0,
    fatPer100g: 1.0,
    cupG: 185,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "oats",
    name: "Oats",
    aliases: ["oats", "rolled oats", "oatmeal"],
    caloriesPer100g: 389,
    proteinPer100g: 16.9,
    carbsPer100g: 66.3,
    fatPer100g: 6.9,
    cupG: 80,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "bread",
    name: "Bread",
    aliases: ["bread", "white bread", "wheat bread", "brown bread", "bread slice"],
    caloriesPer100g: 265,
    proteinPer100g: 9.0,
    carbsPer100g: 49.0,
    fatPer100g: 3.2,
    sliceG: 30,
    pieceG: 30,
    cupG: 60,
    tbspG: 10,
  },
  {
    id: "roti",
    name: "Roti",
    aliases: ["roti", "rotis", "chapati", "chapatis", "phulka", "phulkas"],
    caloriesPer100g: 267,
    proteinPer100g: 10.0,
    carbsPer100g: 50.0,
    fatPer100g: 3.3,
    pieceG: 30,
    cupG: 60,
    tbspG: 10,
  },

  // ---------- Dairy & Fats ----------
  {
    id: "curd",
    name: "Curd",
    aliases: ["curd", "dahi", "plain yogurt", "yogurt", "yoghurt"],
    caloriesPer100g: 60,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatPer100g: 3.3,
    cupG: 240,
    katoriG: 150,
    glassG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "milk",
    name: "Milk",
    aliases: ["milk", "toned milk", "cow milk", "doodh", "whole milk"],
    caloriesPer100g: 60,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
    glassG: 250,
    cupG: 240,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "butter",
    name: "Butter",
    aliases: ["butter", "makhan"],
    caloriesPer100g: 717,
    proteinPer100g: 0.9,
    carbsPer100g: 0.1,
    fatPer100g: 81.1,
    tbspG: 14,
    tspG: 5,
    pieceG: 10,
    cupG: 227,
  },
  {
    id: "ghee",
    name: "Ghee",
    aliases: ["ghee", "clarified butter", "desi ghee"],
    caloriesPer100g: 900,
    proteinPer100g: 0.0,
    carbsPer100g: 0.0,
    fatPer100g: 100.0,
    tbspG: 15,
    tspG: 5,
    cupG: 220,
  },
  {
    id: "oil",
    name: "Oil",
    aliases: ["oil", "cooking oil", "vegetable oil", "sunflower oil", "mustard oil", "olive oil", "tel"],
    caloriesPer100g: 884,
    proteinPer100g: 0.0,
    carbsPer100g: 0.0,
    fatPer100g: 100.0,
    tbspG: 14,
    tspG: 5,
    cupG: 215,
  },
  {
    id: "paneer",
    name: "Paneer",
    aliases: ["paneer", "cottage cheese", "indian cottage cheese"],
    caloriesPer100g: 265,
    proteinPer100g: 18.3,
    carbsPer100g: 3.4,
    fatPer100g: 20.8,
    pieceG: 25,
    cupG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "tofu",
    name: "Tofu",
    aliases: ["tofu", "soy paneer", "bean curd"],
    caloriesPer100g: 76,
    proteinPer100g: 8.0,
    carbsPer100g: 1.9,
    fatPer100g: 4.8,
    pieceG: 50,
    cupG: 125,
    tbspG: 15,
    tspG: 5,
  },

  // ---------- Proteins (Raw vs Cooked explicit) ----------
  {
    id: "chicken_breast_raw",
    name: "Chicken breast (raw)",
    aliases: ["chicken breast", "chicken", "boneless chicken", "raw chicken breast"],
    caloriesPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0.0,
    fatPer100g: 3.6,
    pieceG: 150,
    cupG: 140,
    tbspG: 15,
  },
  {
    id: "chicken_cooked",
    name: "Chicken (cooked)",
    aliases: ["cooked chicken", "grilled chicken", "boiled chicken"],
    caloriesPer100g: 220,
    proteinPer100g: 30.0,
    carbsPer100g: 0.0,
    fatPer100g: 10.0,
    pieceG: 150,
    cupG: 140,
    tbspG: 15,
  },
  {
    id: "fish",
    name: "Fish",
    aliases: ["fish", "fish fillet", "salmon", "rohu", "catla", "tilapia"],
    caloriesPer100g: 120,
    proteinPer100g: 20.0,
    carbsPer100g: 0.0,
    fatPer100g: 4.0,
    pieceG: 150,
    cupG: 140,
    tbspG: 15,
  },
  {
    id: "egg",
    name: "Egg",
    aliases: ["egg", "eggs", "anda", "whole egg", "boiled egg"],
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    pieceG: 50,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "egg_white",
    name: "Egg white",
    aliases: ["egg white", "egg whites", "boiled egg white"],
    caloriesPer100g: 52,
    proteinPer100g: 10.9,
    carbsPer100g: 0.7,
    fatPer100g: 0.2,
    pieceG: 33,
    cupG: 200,
    tbspG: 15,
    tspG: 5,
  },

  // ---------- Fruits & Nuts ----------
  {
    id: "banana",
    name: "Banana",
    aliases: ["banana", "bananas", "kela"],
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    pieceG: 118,
    cupG: 150,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "apple",
    name: "Apple",
    aliases: ["apple", "apples", "seb"],
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    pieceG: 182,
    cupG: 125,
    tbspG: 12,
    tspG: 4,
  },
  {
    id: "orange",
    name: "Orange",
    aliases: ["orange", "oranges", "santra"],
    caloriesPer100g: 47,
    proteinPer100g: 0.9,
    carbsPer100g: 11.8,
    fatPer100g: 0.1,
    pieceG: 130,
    cupG: 180,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "mango",
    name: "Mango",
    aliases: ["mango", "mangoes", "aam"],
    caloriesPer100g: 60,
    proteinPer100g: 0.8,
    carbsPer100g: 15.0,
    fatPer100g: 0.4,
    pieceG: 200,
    cupG: 165,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "almonds",
    name: "Almonds",
    aliases: ["almonds", "almond", "badam"],
    caloriesPer100g: 579,
    proteinPer100g: 21.2,
    carbsPer100g: 21.6,
    fatPer100g: 49.9,
    pieceG: 1.2,
    handfulG: 28,
    cupG: 140,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "walnuts",
    name: "Walnuts",
    aliases: ["walnuts", "walnut", "akhrot"],
    caloriesPer100g: 654,
    proteinPer100g: 15.2,
    carbsPer100g: 13.7,
    fatPer100g: 65.2,
    pieceG: 4.0,
    handfulG: 28,
    cupG: 120,
    tbspG: 10,
    tspG: 3,
  },
  {
    id: "peanuts",
    name: "Peanuts",
    aliases: ["peanuts", "peanut", "moongphali"],
    caloriesPer100g: 567,
    proteinPer100g: 25.8,
    carbsPer100g: 16.1,
    fatPer100g: 49.2,
    handfulG: 28,
    cupG: 145,
    tbspG: 15,
    tspG: 5,
  },
  {
    id: "cashews",
    name: "Cashews",
    aliases: ["cashews", "cashew", "kaju"],
    caloriesPer100g: 553,
    proteinPer100g: 18.2,
    carbsPer100g: 30.2,
    fatPer100g: 43.8,
    pieceG: 1.5,
    handfulG: 28,
    cupG: 130,
    tbspG: 10,
    tspG: 3,
  },

  // ---------- Sweeteners & Seasonings ----------
  {
    id: "sugar",
    name: "Sugar",
    aliases: ["sugar", "white sugar", "chini"],
    caloriesPer100g: 387,
    proteinPer100g: 0.0,
    carbsPer100g: 100.0,
    fatPer100g: 0.0,
    tspG: 4,
    tbspG: 12,
    cupG: 200,
  },
  {
    id: "salt",
    name: "Salt",
    aliases: ["salt", "namak", "table salt", "sea salt"],
    caloriesPer100g: 0,
    proteinPer100g: 0.0,
    carbsPer100g: 0.0,
    fatPer100g: 0.0,
    tspG: 6,
    tbspG: 18,
    pinchG: 0.5,
    cupG: 280,
    isZeroCalorie: true,
  },
  {
    id: "spices",
    name: "Spices",
    aliases: [
      "turmeric",
      "haldi",
      "cumin",
      "jeera",
      "coriander powder",
      "chilli powder",
      "red chilli powder",
      "black pepper",
      "garam masala",
      "mustard seeds",
      "rai",
    ],
    caloriesPer100g: 0,
    proteinPer100g: 0.0,
    carbsPer100g: 0.0,
    fatPer100g: 0.0,
    tspG: 3,
    tbspG: 9,
    pinchG: 0.5,
    cupG: 100,
    isZeroCalorie: true,
  },
];

// Pre-sorted alias map for longest-match search
const ALIAS_ENTRIES = FOOD_DEFINITIONS.flatMap((def) =>
  def.aliases.map((alias) => ({
    alias: alias.toLowerCase().trim(),
    def,
  })),
).sort((a, b) => b.alias.length - a.alias.length);

/** Find ingredient definition by longest alias match */
export function findFoodDefinition(name: string): FoodDefinition | undefined {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return undefined;

  for (const entry of ALIAS_ENTRIES) {
    const pattern = new RegExp(`\\b${entry.alias}\\b`, "i");
    if (pattern.test(clean)) {
      return entry.def;
    }
  }

  return undefined;
}

export function calculateFoodMacros(
  food: FoodDefinition,
  amount: number,
  unit?: string,
  size?: "small" | "medium" | "large",
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
} {
  if (food.isZeroCalorie) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 };
  }

  const u = (unit ?? "").toLowerCase().trim();
  let grams = 100;

  if (u === "g" || u === "gm" || u === "gms" || u === "gram" || u === "grams") {
    grams = amount;
  } else if (
    u === "kg" ||
    u === "kgs" ||
    u === "kilogram" ||
    u === "kilograms" ||
    u === "kilo" ||
    u === "kilos"
  ) {
    grams = amount * 1000;
  } else if (u === "ml" || u === "millilitre" || u === "milliliter") {
    grams = amount;
  } else if (u === "l" || u === "litre" || u === "liter") {
    grams = amount * 1000;
  } else if (u === "oz" || u === "ounce" || u === "ounces") {
    grams = amount * 28.35;
  } else if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") {
    grams = amount * 453.59;
  } else if (u.startsWith("tbsp") || u.startsWith("tablespoon")) {
    grams = amount * (food.tbspG ?? 15);
  } else if (u.startsWith("tsp") || u.startsWith("teaspoon")) {
    grams = amount * (food.tspG ?? 5);
  } else if (u.startsWith("cup")) {
    grams = amount * (food.cupG ?? 150);
  } else if (u.startsWith("katori") || u.startsWith("bowl")) {
    grams = amount * (food.katoriG ?? food.cupG ?? 150);
  } else if (u.startsWith("glass")) {
    grams = amount * (food.glassG ?? 250);
  } else if (u.startsWith("clove")) {
    grams = amount * (food.cloveG ?? 3);
  } else if (u.startsWith("slice")) {
    grams = amount * (food.sliceG ?? 30);
  } else if (u.startsWith("handful")) {
    grams = amount * (food.handfulG ?? 28);
  } else if (u.startsWith("pinch")) {
    grams = amount * (food.pinchG ?? 0.5);
  } else {
    // Countable piece or unit-less
    const basePiece = food.pieceG ?? food.sliceG ?? food.cloveG ?? 100;
    let multiplier = 1;
    if (size === "small") multiplier = 0.75;
    else if (size === "large") multiplier = 1.3;
    grams = amount * basePiece * multiplier;
  }

  const factor = grams / 100;
  return {
    calories: Math.round(food.caloriesPer100g * factor),
    protein: Math.round(food.proteinPer100g * factor * 10) / 10,
    carbs: Math.round(food.carbsPer100g * factor * 10) / 10,
    fat: Math.round(food.fatPer100g * factor * 10) / 10,
    grams: Math.round(grams),
  };
}
