/**
 * Pure text parsing for a typed meal description. Nothing here knows
 * about the Food DB, saved foods, or nutrition — it only turns a
 * sentence into segments and a segment into a (name, amount, unit, size)
 * guess.
 */

/**
 * Split a typed description into candidate food segments on punctuation
 * (never inside decimals like "1.5"), food-list conjunctions
 * ("and"/"with"/"plus" as whole words — "coriander" stays intact),
 * and newlines.
 */
export function splitDescriptionSegments(description: string): string[] {
  return description
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

const UNITS_REGEX_STR =
  "teaspoons?|tsp|tablespoons?|tbsp|cups?|bowls?|katoris?|glasses?|glass|" +
  "millilitres?|milliliters?|ml|litres?|liters?|l|" +
  "grams?|gm|gms|g|kilograms?|kilos?|kg|kgs|" +
  "ounces?|oz|pounds?|lbs?|lb|" +
  "pieces?|pcs?|pc|slices?|cloves?|sprigs?|" +
  "pinches?|pinch|handfuls?|handful|servings?|plates?";

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
    `^(a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?:\\s+(${UNITS_REGEX_STR}))?\\s+(.+)$`,
    "i",
  );
  const wordMatch = trimmed.match(wordNumRegex);
  if (wordMatch) {
    const val = NUMBER_WORDS[wordMatch[1]!.toLowerCase()] ?? 1;
    const possibleUnit = wordMatch[2];
    const remainder = wordMatch[3]!;
    return parseRest(val, remainder, possibleUnit);
  }

  // Fallback: no leading quantity
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
  let unit = initialUnit ? initialUnit.trim().toLowerCase() : undefined;
  let size: "small" | "medium" | "large" | undefined;

  // Check if initialUnit is actually a size modifier
  if (unit && /^(small|medium|large)$/i.test(unit)) {
    size = unit.toLowerCase() as "small" | "medium" | "large";
    unit = undefined;
  }

  // Check if rest starts with a recognized unit if initialUnit wasn't given
  if (!unit) {
    const unitLeadMatch = rest.match(
      new RegExp(`^(${UNITS_REGEX_STR})\\b(?:\\s+of)?\\s+(.+)$`, "i"),
    );
    if (unitLeadMatch) {
      const matchedUnit = unitLeadMatch[1]!.toLowerCase();
      if (/^(small|medium|large)$/i.test(matchedUnit)) {
        size = matchedUnit as "small" | "medium" | "large";
      } else {
        unit = matchedUnit;
      }
      rest = unitLeadMatch[2]!.trim();
    }
  } else {
    // If unit was captured directly attached or adjacent, strip leading "of" from rest
    rest = cleanFoodName(rest);
  }

  // Check for size in rest: "medium onion", "small tomato"
  if (!size) {
    const sizeMatch = rest.match(new RegExp(`^(${SIZES_REGEX_STR})\\s+(.+)$`, "i"));
    if (sizeMatch) {
      size = sizeMatch[1]!.toLowerCase() as "small" | "medium" | "large";
      rest = sizeMatch[2]!.trim();
    }
  }

  return {
    name: cleanFoodName(rest),
    amount: Math.round(amount * 100) / 100,
    ...(unit ? { unit } : {}),
    ...(size ? { size } : {}),
  };
}
