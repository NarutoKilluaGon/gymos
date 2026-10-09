import type { MealSlot, Micronutrients } from "@/types/gymos";

/** Carb/fat calorie shares, stored as "carbPct,fatPct" (protein is set in
 *  grams, so the split covers what is left). */
export type SplitKey = "45,25" | "40,30" | "50,20";

/** How much logged cardio is added back to the day's calorie budget. */
export type CardioReturn = 0 | 0.5 | 1;

export type ChangeLogEntry = {
  /** ISO timestamp of the change. */
  date: string;
  change: string;
};

export type NourishSettings = {
  /** Daily calorie target before any cardio add-back. */
  kcal: number;
  /** Daily protein target, grams. */
  protein: number;
  split: SplitKey;
  cardioReturn: CardioReturn;
  /** Desired body-weight change, kg per week (negative = loss). */
  weeklyRate: number;
  /** Used for cardio estimates until a weight has been logged. */
  fallbackWeightKg: number;
  /** Free-text dislikes/restrictions; filters suggestions. */
  prefs: string;
  changeLog: ChangeLogEntry[];
};

export type FeelValue = 1 | 2 | 3;
export type DayFeel = Partial<Record<MealSlot, FeelValue>>;
/** Keyed by "YYYY-MM-DD". */
export type FeelMap = Record<string, DayFeel>;

export type CardioLog = {
  id: string;
  name: string;
  detail: string;
  minutes: number;
  kcal: number;
  loggedAt: string;
  durationMin?: number;
};
export type CardioMap = Record<string, CardioLog[]>;

export type DraftSource = "saved" | "catalog" | "ai" | "local" | "manual";

/** One food in the "check before saving" list. Nutrition is for the stated
 *  `qty`; `multiplier` (the ×0.25 stepper) scales it on save. */
export type DraftItem = {
  name: string;
  qty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0..1 */
  confidence: number;
  multiplier: number;
  source: DraftSource;
  note?: string;
  entryId?: string;
} & Micronutrients;
