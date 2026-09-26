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
  weight?: number;
  unit?: "kg" | "lb";
  completed: boolean;
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
  timestamp: Timestamp;
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
