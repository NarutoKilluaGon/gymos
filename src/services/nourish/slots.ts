import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";

export { MEAL_SLOTS };
export type { MealSlot };

/** Clock time used when a day is logged without a time of day (a past day,
 *  or a saved meal) so the record still lands in the right section. */
export const DEFAULT_SLOT_TIME: Record<MealSlot, string> = {
  Breakfast: "08:30",
  Lunch: "13:00",
  Snacks: "16:30",
  Dinner: "20:00",
};

const SLOT_WORDS: Record<string, MealSlot> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  snacks: "Snacks",
  dinner: "Dinner",
  supper: "Dinner",
};

/** Minutes since midnight, with 00:00–03:59 counted as the tail of the
 *  previous evening so a 1 a.m. meal is "Dinner", not "Breakfast". */
export function minutesOfDay(hm: string): number {
  const [hours, minutes] = hm.split(":").map(Number);
  const total = (hours ?? 0) * 60 + (minutes ?? 0);

  return total < 240 ? total + 1440 : total;
}

/** Default section for a time of day. */
export function slotForTime(hm: string): MealSlot {
  const total = minutesOfDay(hm);

  if (total < 690) return "Breakfast"; // before 11:30
  if (total < 990) return "Lunch"; // before 16:30
  if (total < 1170) return "Snacks"; // before 19:30

  return "Dinner";
}

/** Local "HH:MM" of an ISO timestamp, or null when malformed. */
export function timeOfDay(timestamp: string): string | null {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) return null;

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

/** The section a stored meal belongs to: the user's pick when present,
 *  else derived from when it was eaten (every pre-diary record). */
export function slotOfMeal(meal: Pick<Meal, "slot" | "timestamp">): MealSlot {
  if (meal.slot && MEAL_SLOTS.includes(meal.slot)) return meal.slot;

  const hm = timeOfDay(meal.timestamp);

  return hm ? slotForTime(hm) : "Snacks";
}

const SLOT_NOUN = "(breakfast|lunch|snacks?|dinner|supper)";
const COMPOUND_NOUN =
  /\b(lunch|dinner|supper|snacks?|breakfast)[\s-]?(box|boxes|plate|menu|buffet|special|combo|thali|roll|rolls|time|party|meeting|date|club|hour)\b/g;
const SLOT_PATTERN = new RegExp(
  "\\b(?:(?:for|as|at|during|after|before|in the)\\s+" +
    SLOT_NOUN +
    "|" +
    SLOT_NOUN +
    "\\s*[:\\-–—]|(?:had|ate|eating|having)\\s+" +
    SLOT_NOUN +
    "\\b|^\\s*" +
    SLOT_NOUN +
    "\\b)",
  "g",
);

/**
 * The section a message explicitly names ("eggs for breakfast",
 * "dinner: dal rice"), or null when it names none or names several.
 * "lunch box" and friends are foods/places, not a section.
 */
export function slotFromText(text: string): MealSlot | null {
  const cleaned = text.toLowerCase().replace(COMPOUND_NOUN, " ");
  const hits = new Set<MealSlot>();
  const pattern = new RegExp(SLOT_PATTERN.source, "g");
  let match = pattern.exec(cleaned);

  while (match) {
    const word = match[1] ?? match[2] ?? match[3] ?? match[4];
    const slot = word ? SLOT_WORDS[word] : undefined;

    if (slot) hits.add(slot);
    match = pattern.exec(cleaned);
  }

  const mentioned = new Set<MealSlot>();

  for (const word of cleaned.match(
    /\b(breakfast|lunch|snacks?|dinner|supper)\b/g,
  ) ?? []) {
    const slot = SLOT_WORDS[word];

    if (slot) mentioned.add(slot);
  }

  if (hits.size === 1 && mentioned.size === 1) {
    return [...hits][0] ?? null;
  }

  return null;
}

/**
 * Pick the section for a new entry. Priority: a section named in the
 * message, then the time of day, then the first section still empty on
 * the viewed day, then Snacks.
 */
export function pickSlot(input: {
  /** Section named in the user's message, if any. */
  named: MealSlot | null;
  /** "HH:MM" the food was eaten, or null when the day has no clock. */
  at: string | null;
  /** Sections that already have entries on the viewed day. */
  filled: ReadonlySet<MealSlot>;
}): MealSlot {
  if (input.named) return input.named;
  if (input.at) return slotForTime(input.at);

  return MEAL_SLOTS.find((slot) => !input.filled.has(slot)) ?? "Snacks";
}
