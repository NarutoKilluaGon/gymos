import { isInconsistent } from "@/services/nourish/nutrition";
import type { DraftItem } from "@/types/nourish";

/** Typical values for everyday Indian staples, used (a) to sanity-check
 *  estimates and (b) as a last-resort local estimate when the AI is
 *  unreachable and the food catalog has no exact match. */
const BASIS_LABEL: Record<RefFood["basis"], string> = {
  each: "1 piece",
  katori: "1 katori",
  "100g": "100 g",
  glass: "1 glass",
  tbsp: "1 tbsp",
};

type RefFood = {
  id: string;
  test: RegExp;
  /** What one "unit" of the numbers below means. */
  basis: "each" | "katori" | "100g" | "glass" | "tbsp";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const REF_FOODS: readonly RefFood[] = [
  { id: "egg", test: /\beggs?\b|\banda\b/, basis: "each", calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: "roti", test: /\brot(?:i|is)\b|chapati|phulka/, basis: "each", calories: 100, protein: 3, carbs: 18, fat: 2 },
  { id: "paratha", test: /paratha/, basis: "each", calories: 260, protein: 6, carbs: 36, fat: 10 },
  { id: "idli", test: /idli/, basis: "each", calories: 40, protein: 2, carbs: 8, fat: 0.2 },
  { id: "dosa", test: /dosa/, basis: "each", calories: 170, protein: 4, carbs: 26, fat: 5 },
  { id: "banana", test: /banana/, basis: "each", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "rice", test: /\brice\b|chawal/, basis: "katori", calories: 195, protein: 4, carbs: 43, fat: 0.5 },
  { id: "dal", test: /\bdaa?l\b/, basis: "katori", calories: 150, protein: 8, carbs: 20, fat: 4 },
  { id: "curd", test: /curd|dahi|yogh?urt/, basis: "katori", calories: 60, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { id: "milk", test: /\bmilk\b|doodh/, basis: "glass", calories: 160, protein: 8, carbs: 12, fat: 8 },
  { id: "paneer", test: /paneer/, basis: "100g", calories: 300, protein: 18, carbs: 3, fat: 23 },
  { id: "chicken", test: /chicken/, basis: "100g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "ghee", test: /\bghee\b|\boil\b/, basis: "tbsp", calories: 120, protein: 0, carbs: 0, fat: 14 },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

const NUMBER_WORD_PATTERN = "a|an|one|two|three|four|five|six|seven|eight|nine|ten|half";
const UNIT_PATTERN = "grams?|gm|g|ml|tbsp|tsp|katori|bowl|glass|cup";

const QUANTITY = new RegExp(
  `(\\d+(?:\\.\\d+)?|\\b(?:${NUMBER_WORD_PATTERN})\\b)\\s*(?:(${UNIT_PATTERN})\\b)?`,
);
const LEADING_QUANTITY = new RegExp(
  `^[\\d.\\s]*(?:${UNIT_PATTERN})?\\s*(?:of\\s+)?`,
);
const NUMBER_WORDS_ANYWHERE = new RegExp(
  `\\b(${NUMBER_WORD_PATTERN})\\b`,
  "g",
);

function capitalize(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/**
 * Estimate a comma/and-separated list from the staples table. Returns null
 * unless EVERY part is recognised — a partial guess would silently drop
 * foods from the day.
 */
export function localFoodItems(text: string): DraftItem[] | null {
  const parts = text
    .toLowerCase()
    .split(/,|\band\b|\+|&|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const items: DraftItem[] = [];

  for (const part of parts) {
    const ref = REF_FOODS.find((food) => food.test.test(part));

    if (!ref) return null;

    const match = part.match(QUANTITY);
    const unit = match?.[2] ?? "";
    const leading = match?.[1];
    const quantity = leading
      ? (NUMBER_WORDS[leading] ?? Number(leading))
      : 1;
    const metric = /^(g|gm|gram|grams|ml)$/.test(unit);
    let factor = quantity;

    if (ref.basis === "100g") factor = metric ? quantity / 100 : quantity;
    else if (ref.basis === "katori") factor = metric ? quantity / 150 : quantity;
    else if (ref.basis === "glass") factor = metric ? quantity / 250 : quantity;
    else if (ref.basis === "tbsp") factor = unit === "tsp" ? quantity / 3 : quantity;

    const cleaned = part
      .replace(LEADING_QUANTITY, "")
      .replace(NUMBER_WORDS_ANYWHERE, "")
      .replace(/\s+/g, " ")
      .trim();

    items.push({
      name: capitalize(cleaned || ref.id),
      // A bare name ("dal") describes one usual unit, not the text itself.
      qty: match?.[1] ? part : BASIS_LABEL[ref.basis],
      calories: ref.calories * factor,
      protein: ref.protein * factor,
      carbs: ref.carbs * factor,
      fat: ref.fat * factor,
      confidence: 0.6,
      multiplier: 1,
      source: "local",
    });
  }

  return items.length > 0 ? items : null;
}

const COUNTABLE =
  /(\d+(?:\.\d+)?)\s*(?:[a-z]+\s+){0,2}?(eggs?|rotis?|chapatis?|idlis?|bananas?)\b/;

/**
 * Correct countable staples whose protein is wildly off for the stated
 * count (the classic "per 100 g treated as per portion" error): protein is
 * pinned to the typical value, carbs/fat are capped near it, calories are
 * recomputed, and confidence drops to "estimate".
 */
export function checkCountables(items: readonly DraftItem[]): DraftItem[] {
  return items.map((item) => {
    // A weight/volume-based quantity isn't a count of whole items.
    if (/\d\s*(?:g|gm|kg|ml|l)\b/i.test(item.qty)) return item;

    const match = `${item.qty} ${item.name}`.toLowerCase().match(COUNTABLE);

    if (!match) return item;

    const ref = REF_FOODS.find((food) => food.test.test(match[2] ?? ""));

    if (!ref) return item;

    const count = Number(match[1]);
    const expectedProtein = ref.protein * count;

    if (
      item.protein <= expectedProtein * 1.5 + 4 &&
      item.protein >= expectedProtein * 0.5
    ) {
      return item;
    }

    const expectedCarbs = ref.carbs * count;
    const expectedFat = ref.fat * count;
    const batches = Math.ceil(count / 4);
    const carbs =
      expectedCarbs +
      Math.min(Math.max(item.carbs - expectedCarbs, 0), 3 * batches);
    const fat =
      expectedFat +
      Math.min(Math.max(item.fat - expectedFat, 0), 8 * batches);
    const protein = Math.round(expectedProtein);

    return {
      ...item,
      protein,
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      calories: Math.round(4 * protein + 4 * carbs + 9 * fat),
      confidence: Math.min(item.confidence, 0.5),
      note: "Adjusted to typical values",
    };
  });
}

/** When calories disagree with the macros, trust the macros and say so. */
export function reconcileEnergy(items: readonly DraftItem[]): DraftItem[] {
  return items.map((item) =>
    isInconsistent(item)
      ? {
          ...item,
          calories: Math.round(
            4 * item.protein + 4 * item.carbs + 9 * item.fat,
          ),
          confidence: Math.min(item.confidence, 0.5),
        }
      : item,
  );
}
