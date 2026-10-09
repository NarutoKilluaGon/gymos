import type { LoadType } from "./forge";

export type ID = string;

export type Timestamp = string;

export type MeasurementUnit = "kg" | "lb" | "in" | "cm" | "%";

export type MeasurementType =
  | "weight"
  | "bodyFat"
  | "biceps"
  | "waist"
  | "chest"
  | "thigh";

export type WaterEntry = {
  id: ID;
  amountMl: number;
  timestamp: Timestamp;
};

export type WorkoutSet = {
  id: ID;
  reps: number;
  /** Load in `unit`. For a bodyweight exercise this is the EXTRA load
   *  (negative = assisted), added to the session's body weight. */
  weight?: number;
  unit?: "kg" | "lb";
  completed: boolean;
  /** Warm-up sets are logged but never count toward volume, PRs or
   *  history. Absent on every record saved before Forge. */
  warmup?: boolean;
  /** Whether this set was taken to muscular failure. */
  toFailure?: boolean;
};

export type CardioActivity =
  | "running"
  | "walking"
  | "cycling"
  | "swimming"
  | "stairmaster"
  | "rowing"
  | "elliptical"
  | "custom";

export type CardioEntry = {
  id: ID;
  activity: CardioActivity;
  /** Display name for `custom` activities. */
  name?: string;
  durationMin: number;
  distanceKm?: number;
  calories?: number;
  loggedAt: Timestamp;
};

export type WorkoutExercise = {
  id: ID;
  exerciseId: ID;
  name: string;
  sets: WorkoutSet[];
  /** Load is body weight plus the set's (extra) weight. */
  bodyweight?: boolean;
  loadType?: LoadType;
  note?: string;
  /** Coaching cue carried over from the plan. */
  tip?: string;
  /** Exercises sharing a group id and adjacent in order form a superset. */
  group?: string;
  /** The last session hit the top of the rep range on every set, so the
   *  planned weight was nudged up. */
  progressed?: boolean;
  /** Planned rep target expression (e.g. "8-10", "8+", "AMRAP"). */
  repTarget?: string;
};

export type SessionPr = {
  exerciseId: ID;
  weight: number;
  reps: number;
  unit: "kg" | "lb";
};

export type WorkoutSession = {
  id: ID;
  name: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  exercises: WorkoutExercise[];
  routineId?: ID;
  cardio?: CardioEntry[];
  notes?: string;
  /** Local "YYYY-MM-DD" the session belongs to. Derived from `startedAt`
   *  for sessions saved before Forge. */
  date?: string;
  planId?: ID;
  dayId?: ID;
  /** Deload week: fewer sets, lighter loads. */
  deload?: boolean;
  /** Body weight (kg) at the time; makes bodyweight loads comparable. */
  bodyweightKg?: number;
  /** Total time spent paused, ms. */
  pausedMs?: number;
  /** Set while paused. */
  pausedAt?: Timestamp;
  /** Active (paused/idle-trimmed) duration, ms, once finished. */
  durationMs?: number;
  /** Logged after the fact: has no meaningful duration. */
  backdated?: boolean;
  /** Last time anything was edited; drives idle-time trimming. */
  lastActivityAt?: Timestamp;
  prs?: SessionPr[];
};

export type RoutineExercise = {
  exerciseId: ID;
  name: string;
  order: number;
};

export type Routine = {
  id: ID;
  name: string;
  description?: string;
  exercises: RoutineExercise[];
  archived?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Canonical macro keys (energy + macros). */
export const MACRO_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/** Canonical micronutrient keys (11 tracked micros). Units, documented
 *  once for the whole pipeline (client, DB, and S2 proxy contract):
 *  fiber g; sodium/potassium/calcium/iron/magnesium/zinc/vitaminC mg;
 *  vitaminA/vitaminD/vitaminB12/folate built from µg amounts. */
export const MICRONUTRIENT_KEYS = [
  "fiber",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "zinc",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminB12",
  "folate",
] as const;
export type MicronutrientKey = (typeof MICRONUTRIENT_KEYS)[number];

/** All micronutrient values are optional so persisted records saved before
 *  micros existed keep loading unchanged (absent reads as untracked). */
export type Micronutrients = {
  [K in MicronutrientKey]?: number;
};

/**
 * Transient provenance for a review food row. This is intentionally not
 * persisted on MealFood/Meal records yet: the stored nutrition remains the
 * source of truth, while review can distinguish catalog values from AI or
 * manual values without a storage migration.
 */
export type NutritionSource = "food-db" | "ai" | "manual";

/** The four diary sections a logged food belongs to. */
export const MEAL_SLOTS = [
  "Breakfast",
  "Lunch",
  "Snacks",
  "Dinner",
] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** One food as it appears in a review list before it is saved. Totals are
 *  for the WHOLE stated amount, never per 100 g. */
export type EstimatedFood = {
  name: string;
  estimatedAmount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Offline food-database entry id when nutrition came from the catalog. */
  entryId?: string;
  /** True when no confident match existed: macros are zero as "unknown",
   *  never as a measurement. Never persisted. */
  unresolved?: boolean;
  /** Transient provenance; not written to the persisted record. */
  nutritionSource?: NutritionSource;
} & Micronutrients;

/** Canonical nutrient key list, macros first: the single enumerator every
 *  summation/scaling helper iterates. Extend here, never per call-site. */
export const NUTRIENT_KEYS: readonly (MacroKey | MicronutrientKey)[] = [
  ...MACRO_KEYS,
  ...MICRONUTRIENT_KEYS,
];

/** Defined micro values carried forward (skips missing/garbage). */
export function pickMicronutrients(source: {
  [K in MicronutrientKey]?: unknown;
}): Micronutrients {
  const out: Micronutrients = {};

  for (const key of MICRONUTRIENT_KEYS) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }

  return out;
}

/** One extra nested under a single food (e.g. ghee on a dosa).
 *  LEGACY (pre-S6A): the meal editor no longer creates or edits these —
 *  the type stays so persisted records remain readable, and their
 *  nutrition is still summed (computeMealTotals) / folded on reopen
 *  (mealToEstimate). */
export type FoodAdditional = {
  id: ID;
  /** Food database entry id, when the additional came from the catalog. */
  entryId?: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} & Micronutrients;

/** One food within a logged or saved meal (S6A: a meal simply contains
 *  foods — no additionals are ever created anymore). */
export type MealFood = {
  name: string;
  amount?: number;
  unit?: string;
  /** Offline food-database entry id when the nutrition came from the
   *  catalog — lets a later amount/unit edit rescale this row from the
   *  catalog portion. Absent for manually-entered or pre-S6A foods. */
  entryId?: string;
  /** Human portion label ("2 rotis", "1 katori"). Optional so records
   *  saved before the Nourish diary keep loading unchanged. */
  qty?: string;
  /** 0..1 confidence in the estimate. Absent reads as "unknown". */
  confidence?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Legacy per-food extras (pre-S6A). Never created; still summed on
   *  read and folded on review so stored nutrition is never lost. */
  additionals?: FoodAdditional[];
} & Micronutrients;

export type Meal = {
  id: ID;
  name: string;
  /** When the food was eaten (local time of day decides the default slot
   *  and the diary day). */
  timestamp: Timestamp;
  /** Diary section picked by the user or read from their message. When
   *  absent (every record saved before the Nourish diary) the slot is
   *  derived from the timestamp. */
  slot?: MealSlot;
  /** Human portion label, e.g. "2 rotis". */
  qty?: string;
  /** 0..1 confidence in the estimate; absent reads as unknown. */
  confidence?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Optional per-food breakdown. Totals on this record stay
   *  authoritative — every existing reader (summary cards, insights,
   *  streak, export) only reads the flat totals, so meals saved before
   *  this field existed keep working unchanged. */
  foods?: MealFood[];
} & Micronutrients;

export type SleepSession = {
  id: ID;
  startedAt: Timestamp;
  endedAt?: Timestamp;
};

export type Measurement = {
  id: ID;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  timestamp: Timestamp;
};

export type JournalEntry = {
  id: ID;
  text: string;
  mood?: "great" | "good" | "okay" | "tired" | "rough";
  timestamp: Timestamp;
};

export type GoalType =
  | "gainMuscle"
  | "loseWeight"
  | "buildStrength"
  | "maintainWeight"
  | "improveEndurance";

export type NorthStar = {
  title: string;
  why: string;
  lastChangedAt: string;
  goalType?: GoalType;
  metric?: MeasurementType;
  targetValue?: number;
  unit?: MeasurementUnit;
};

export type PersonalRecord = {
  exerciseId: ID;
  weight: number;
  reps: number;
  unit: "kg" | "lb";
  timestamp: Timestamp;
};

export type ProgressPhoto = {
  id: ID;
  /** file:// URI of the copy stored in the app's documents directory. */
  uri: string;
  /** YYYY-MM-DD when the photo was logged. */
  date: string;
  timestamp: Timestamp;
  note?: string;
};

export type DailyActivity = {
  date: string;
  water: WaterEntry[];
  workouts: WorkoutSession[];
  meals: Meal[];
  sleep: SleepSession[];
  measurements: Measurement[];
  journal: JournalEntry[];
};
