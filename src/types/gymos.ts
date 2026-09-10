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

export type Meal = {
  id: ID;
  name: string;
  timestamp: Timestamp;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

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
