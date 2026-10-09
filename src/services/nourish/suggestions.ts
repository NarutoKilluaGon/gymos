import { FOOD_DATABASE, normalizeFoodName } from "@/services/food-db";

export type SuggestionCandidate = {
  name: string;
  qty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  origin: "saved" | "catalog";
};

export type Suggestion = SuggestionCandidate & { why: string };

const NON_VEG =
  /chicken|mutton|lamb|fish|prawn|shrimp|tuna|salmon|keema|meat|beef|pork|crab|bacon|sausage/;
const EGG = /\begg|omelet|omelette|bhurji/;
const DAIRY =
  /paneer|curd|dahi|milk|doodh|ghee|cheese|whey|lassi|buttermilk|chaas|butter|yogh?urt|raita|khoa|malai|cream/;

/** Words that mean "skip these foods" in a free-text preference note. */
function avoidedWords(prefs: string): string[] {
  const words: string[] = [];
  const pattern =
    /\b(?:no|avoid|allergic to|hate|dislike|without|cannot eat|can't eat)\s+([a-z][a-z ,/&]*)/g;
  let match = pattern.exec(prefs);

  while (match) {
    for (const token of (match[1] ?? "").split(/,|\/|&|\band\b|\bor\b/)) {
      const word = normalizeFoodName(token.trim());

      if (word.length >= 3) words.push(word);
    }

    match = pattern.exec(prefs);
  }

  return words;
}

/** Whether a food fits the user's free-text restrictions. Conservative on
 *  purpose: it only excludes on clear signals (vegetarian, vegan,
 *  egg-free, or "no <food>"). */
export function allowedByPrefs(name: string, prefs: string): boolean {
  const text = prefs.toLowerCase();
  const food = name.toLowerCase();

  if (!text.trim()) return true;

  const vegan = /\bvegan\b/.test(text);
  const eggetarian = /eggetarian|\beats? eggs?\b|\beggs? (?:ok|fine|allowed)\b/.test(
    text,
  );
  const vegetarian =
    vegan || /\bvegetarian\b|\bpure veg\b|\bveg only\b|\bjain\b/.test(text);
  const noEgg = /\bno eggs?\b|\beggless\b|\begg[- ]free\b|\bavoid eggs?\b/.test(
    text,
  );

  if (vegetarian && NON_VEG.test(food)) return false;
  if (vegetarian && !eggetarian && EGG.test(food)) return false;
  if (noEgg && EGG.test(food)) return false;
  if (vegan && DAIRY.test(food)) return false;

  const normalizedFood = normalizeFoodName(name);

  return !avoidedWords(text).some((word) => normalizedFood.includes(word));
}

export function catalogCandidates(): SuggestionCandidate[] {
  return FOOD_DATABASE.map((entry) => ({
    name: entry.name,
    qty: `${entry.amount} ${entry.unit}`,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    origin: "catalog" as const,
  }));
}

const MIN_USEFUL_PROTEIN = 8;
const LEAN_CALORIE_CEILING = 200;
const USUAL_FOOD_BONUS = 1.15;

/**
 * Up to `limit` foods that close the protein gap, best protein-per-calorie
 * first. Nothing is invented: every option is a saved/usual food or a
 * catalog entry, filtered by the user's own restrictions. When calories
 * are already spent, only lean options (≤200 kcal) qualify.
 */
export function suggestProteinOptions(input: {
  gapGrams: number;
  kcalLeft: number;
  prefs: string;
  candidates: readonly SuggestionCandidate[];
  limit?: number;
}): Suggestion[] {
  const limit = input.limit ?? 3;
  const ceiling =
    input.kcalLeft > 150 ? input.kcalLeft : LEAN_CALORIE_CEILING;
  const seen = new Set<string>();

  const ranked = input.candidates
    .filter(
      (candidate) =>
        candidate.protein >= MIN_USEFUL_PROTEIN &&
        candidate.calories > 0 &&
        candidate.calories <= ceiling &&
        allowedByPrefs(candidate.name, input.prefs),
    )
    .map((candidate) => ({
      candidate,
      score:
        (candidate.protein / candidate.calories) *
        (candidate.origin === "saved" ? USUAL_FOOD_BONUS : 1),
    }))
    .sort((a, b) => b.score - a.score);

  const picked: Suggestion[] = [];

  for (const { candidate } of ranked) {
    const key = normalizeFoodName(candidate.name);

    if (seen.has(key)) continue;

    seen.add(key);

    const protein = Math.round(candidate.protein);
    const kcal = Math.round(candidate.calories);
    const tail =
      candidate.origin === "saved"
        ? "one of your usual foods"
        : input.kcalLeft > 0
          ? "fits what you have left today"
          : "lean for the calories";

    picked.push({
      ...candidate,
      why: `${protein}g protein for ${kcal} kcal, ${tail}.`,
    });

    if (picked.length >= limit) break;
  }

  return picked;
}
