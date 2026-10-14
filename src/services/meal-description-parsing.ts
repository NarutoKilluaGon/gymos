/**
 * Pure text parsing for a typed meal description. Nothing here knows
 * about the Food DB, saved foods, or nutrition — it only turns a
 * sentence into segments and a segment into a (name, amount, unit, size)
 * guess.
 */

/**
 * Recognized multi-item combined dish names that contain conjunctions
 * ("and", "with", "&") which should NOT be split into separate items.
 */
const COMBINED_DISH_CONJUNCTIONS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b(chole|chhole)\s+(?:and|with|&)\s+(bhatur(?:e|a|as)?)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(pav|pao)\s+(?:and|with|&)\s+(bhaji)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(puri|poori)\s+(?:and|with|&)\s+(bhaji)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(rajma)\s+(?:and|with|&)\s+(chawal)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(dal|daal)\s+(?:and|with|&)\s+(chawal)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(idli)\s+(?:and|with|&)\s+(sambar)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(vada|wada)\s+(?:and|with|&)\s+(sambar)\b/gi, replacement: "$1 $2" },
  { pattern: /\b(makki(?:\s+di)?\s+roti)\s+(?:and|with|&)\s+(sarson(?:\s+da)?\s+saag)\b/gi, replacement: "$1 $2" },
];

/**
 * Split a typed description into candidate food segments on punctuation
 * (never inside decimals like "1.5"), food-list conjunctions
 * ("and"/"with"/"plus" as whole words — "coriander" stays intact),
 * and newlines. Combined dish names with "and"/"with" are kept together.
 */
export function splitDescriptionSegments(description: string): string[] {
  let text = description;
  for (const { pattern, replacement } of COMBINED_DISH_CONJUNCTIONS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .split(/\r?\n+|[;,+&]+|\.\s+|\s+(?:and|with|plus)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export type ParsedQuantity = {
  name: string;
  amount?: number;
  unit?: string;
  size?: "small" | "medium" | "large";
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

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
};

const CANONICAL_UNITS: readonly string[] = [
  "tablespoon", "tablespoons", "tbsp",
  "teaspoon", "teaspoons", "tsp",
  "gram", "grams", "gm", "gms", "g",
  "kilogram", "kilograms", "kilo", "kilos", "kg",
  "millilitre", "milliliters", "milliliter", "millilitres", "ml",
  "litre", "liters", "liter", "litres", "l",
  "cup", "cups",
  "bowl", "bowls",
  "katori", "katoris",
  "glass", "glasses",
  "piece", "pieces", "pc", "pcs",
  "slice", "slices",
  "clove", "cloves",
  "pinch", "pinches",
  "handful", "handfuls",
  "serving", "servings",
  "plate", "plates",
  "scoop", "scoops",
  "oz", "ounce", "ounces",
  "lb", "pound", "pounds",
];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]!
          : Math.min(row[j - 1]!, row[j]!, prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

/** Match or fuzzy-correct candidate word against canonical units (distance <= 2 for words >= 4 chars). */
export function matchOrFuzzyUnit(candidate: string): string | null {
  const norm = candidate.toLowerCase().trim();
  if (!norm) return null;

  // Exact match first
  for (const u of CANONICAL_UNITS) {
    if (norm === u) return norm;
  }

  // Fuzzy match only for candidate words of length >= 4 with distance <= 2
  if (norm.length >= 4) {
    let bestMatch: string | null = null;
    let bestDist = 3;
    for (const u of CANONICAL_UNITS) {
      if (u.length >= 4 && Math.abs(u.length - norm.length) <= 2) {
        const d = levenshtein(norm, u);
        if (d <= 2 && d < bestDist) {
          bestDist = d;
          bestMatch = u;
        }
      }
    }
    if (bestMatch) return bestMatch;
  }

  return null;
}

const SIZES_REGEX_STR = "small|medium|large";

function parseFractionValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed in UNICODE_FRACTIONS) {
    return UNICODE_FRACTIONS[trimmed]!;
  }
  // Mixed unicode: "1½", "2 ½"
  const mixedUnicode = trimmed.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/);
  if (mixedUnicode) {
    const whole = Number(mixedUnicode[1]);
    const frac = UNICODE_FRACTIONS[mixedUnicode[2]!] ?? 0;
    return whole + frac;
  }
  // Slash fraction: "1/2", "3/4"
  const slashMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (slashMatch) {
    const num = Number(slashMatch[1]);
    const den = Number(slashMatch[2]);
    return den > 0 ? num / den : null;
  }
  // Mixed slash fraction: "1 1/2", "1-1/2"
  const mixedSlash = trimmed.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedSlash) {
    const whole = Number(mixedSlash[1]);
    const num = Number(mixedSlash[2]);
    const den = Number(mixedSlash[3]);
    return den > 0 ? whole + num / den : null;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Split a leading quantity from a typed food name — "1.5 tbsp ghee",
 * "200g rice", "2 banana", "half tomato", "1/2 cup rajma", "salt to taste".
 */
export function parseLeadingQuantity(text: string): ParsedQuantity {
  const trimmed = text.trim();
  if (!trimmed) {
    return { name: "" };
  }

  // 1. "to taste" check (e.g. "salt to taste", "to taste salt")
  const toTasteEnd = trimmed.match(/^(.*?)\s+(?:to\s+taste)$/i);
  if (toTasteEnd) {
    return {
      name: toTasteEnd[1]!.trim(),
      amount: 0,
      unit: "to taste",
    };
  }
  const toTasteStart = trimmed.match(/^(?:to\s+taste)\s+(.*)$/i);
  if (toTasteStart) {
    return {
      name: toTasteStart[1]!.trim(),
      amount: 0,
      unit: "to taste",
    };
  }

  // 2. Idiomatic word phrases: "a couple of", "one and a half", "two and a half"
  const oneAndAHalfMatch = trimmed.match(
    /^(?:one\s+and\s+a\s+half|1\s+and\s+a\s+half)\s+(.+)$/i,
  );
  if (oneAndAHalfMatch) {
    return parseRest(1.5, oneAndAHalfMatch[1]!);
  }

  const twoAndAHalfMatch = trimmed.match(
    /^(?:two\s+and\s+a\s+half|2\s+and\s+a\s+half)\s+(.+)$/i,
  );
  if (twoAndAHalfMatch) {
    return parseRest(2.5, twoAndAHalfMatch[1]!);
  }

  const coupleMatch = trimmed.match(/^(?:a\s+)?couple(?:\s+of)?\s+(.+)$/i);
  if (coupleMatch) {
    return parseRest(2, coupleMatch[1]!);
  }

  const handfulMatch = trimmed.match(
    /^(?:a\s+)?handful(?:\s+of)?\s+(.+)$/i,
  );
  if (handfulMatch) {
    return parseRest(1, handfulMatch[1]!, "handful");
  }

  const pinchMatch = trimmed.match(/^(?:a\s+)?pinch(?:\s+of)?\s+(.+)$/i);
  if (pinchMatch) {
    return parseRest(1, pinchMatch[1]!, "pinch");
  }

  // 3. "half" / "quarter" phrases
  const halfMatch = trimmed.match(
    /^half(?:\s+(?:a|an|of\s+a|of\s+an|of))?\s+(.+)$/i,
  );
  if (halfMatch) {
    return parseRest(0.5, halfMatch[1]!);
  }

  const quarterMatch = trimmed.match(
    /^quarter(?:\s+(?:a|an|of\s+a|of\s+an|of))?\s+(.+)$/i,
  );
  if (quarterMatch) {
    return parseRest(0.25, quarterMatch[1]!);
  }

  // 4. Standalone size lead: "small tomato", "medium onion", "large apple"
  const standaloneSizeMatch = trimmed.match(
    new RegExp(`^(${SIZES_REGEX_STR})\\s+(.+)$`, "i"),
  );
  if (standaloneSizeMatch) {
    const size = standaloneSizeMatch[1]!.toLowerCase() as "small" | "medium" | "large";
    return {
      name: cleanFoodName(standaloneSizeMatch[2]!),
      amount: 1,
      size,
    };
  }

  // 5. Numeric / fraction leading: digits, fractions ("1/2", "1 1/2", "½", "1½", "1.5")
  const numOrFracRegex =
    /^(\d+(?:[\s-]+\d+\/\d+|\/\d+|\.\d+)?|\d*\s*[½¼¾⅓⅔⅛])(?:\s*([a-zA-Z]+))?\s+(.+)$/;
  const numMatch = trimmed.match(numOrFracRegex);

  if (numMatch) {
    const parsedVal = parseFractionValue(numMatch[1]!);
    if (parsedVal !== null && parsedVal > 0) {
      const possibleUnit = numMatch[2];
      const remainder = numMatch[3]!;
      return parseRest(parsedVal, remainder, possibleUnit);
    }
  }

  // 6. Word numbers: "three eggs", "two rotis", "a banana"
  const wordNumRegex = new RegExp(
    `^(a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?:\\s+([a-zA-Z]+))?\\s+(.+)$`,
    "i",
  );
  const wordMatch = trimmed.match(wordNumRegex);
  if (wordMatch) {
    const val = NUMBER_WORDS[wordMatch[1]!.toLowerCase()] ?? 1;
    const possibleUnit = wordMatch[2];
    const remainder = wordMatch[3]!;
    return parseRest(val, remainder, possibleUnit);
  }

  // 7. Trailing quantities: "fried rice 1 bowl", "keema kalegi 200 gm", "frooti 200 ml", "rice 1 cup"
  const trailingRegex =
    /^(.*?)\s+(\d+(?:[\s-]+\d+\/\d+|\/\d+|\.\d+)?|\d*\s*[½¼¾⅓⅔⅛])\s*([a-zA-Z]+)?$/;
  const trailingMatch = trimmed.match(trailingRegex);
  if (trailingMatch) {
    const candidateName = trailingMatch[1]!.trim();
    const candidateVal = parseFractionValue(trailingMatch[2]!);
    const rawUnit = trailingMatch[3];
    if (candidateName && candidateVal !== null && candidateVal > 0) {
      const matchedUnit = rawUnit ? matchOrFuzzyUnit(rawUnit) : null;
      if (rawUnit && matchedUnit) {
        return {
          name: cleanFoodName(candidateName),
          amount: Math.round(candidateVal * 100) / 100,
          unit: matchedUnit,
        };
      } else if (!rawUnit) {
        return {
          name: cleanFoodName(candidateName),
          amount: Math.round(candidateVal * 100) / 100,
        };
      }
    }
  }

  // Fallback: no quantity found
  return { name: trimmed };
}

function cleanFoodName(raw: string): string {
  return raw.replace(/^(?:of\s+|a\s+|an\s+)/i, "").trim();
}

function parseRest(
  amount: number,
  remainderText: string,
  initialUnit?: string,
): ParsedQuantity {
  let rest = remainderText.trim();
  let unit: string | undefined;
  let size: "small" | "medium" | "large" | undefined;

  // Check initialUnit against size or valid unit whitelist
  if (initialUnit) {
    const lowerInitial = initialUnit.toLowerCase().trim();
    if (/^(small|medium|large)$/i.test(lowerInitial)) {
      size = lowerInitial as "small" | "medium" | "large";
    } else {
      const matched = matchOrFuzzyUnit(lowerInitial);
      if (matched) {
        unit = matched;
      } else {
        // Not a unit! Reattach to remainder: e.g. "1 vada pav" -> "vada pav"
        rest = `${initialUnit} ${rest}`.trim();
      }
    }
  }

  // Check if rest starts with a recognized unit if unit wasn't found yet
  if (!unit) {
    const firstWordMatch = rest.match(/^([a-zA-Z]+)\b(?:\s+of)?(?:\s+(.*))?$/);
    if (firstWordMatch) {
      const candidateWord = firstWordMatch[1]!;
      const afterCandidate = (firstWordMatch[2] ?? "").trim();

      if (/^(small|medium|large)$/i.test(candidateWord)) {
        size = candidateWord.toLowerCase() as "small" | "medium" | "large";
        rest = afterCandidate;
      } else {
        const matched = matchOrFuzzyUnit(candidateWord);
        if (matched) {
          unit = matched;
          rest = afterCandidate;
        }
      }
    }
  } else {
    rest = cleanFoodName(rest);
  }

  // Check for size modifier in rest if not already set: "medium onion", "small tomato"
  if (!size) {
    const sizeMatch = rest.match(new RegExp(`^(${SIZES_REGEX_STR})\\s+(.+)$`, "i"));
    if (sizeMatch) {
      size = sizeMatch[1]!.toLowerCase() as "small" | "medium" | "large";
      rest = sizeMatch[2]!.trim();
    }
  }

  // Check for trailing secondary quantity in rest (e.g. "1 frooti 200 ml")
  if (rest) {
    const subTrailing = rest.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (subTrailing) {
      const subName = subTrailing[1]!.trim();
      const subVal = Number(subTrailing[2]);
      const subUnit = matchOrFuzzyUnit(subTrailing[3]!);
      if (subName && Number.isFinite(subVal) && subUnit) {
        return {
          name: cleanFoodName(subName),
          amount: Math.round(subVal * 100) / 100,
          unit: subUnit,
          ...(size ? { size } : {}),
        };
      }
    }
  }

  return {
    name: cleanFoodName(rest),
    amount: Math.round(amount * 100) / 100,
    ...(unit ? { unit } : {}),
    ...(size ? { size } : {}),
  };
}
