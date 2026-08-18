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
  timestamp: Timestamp;
};

export type NorthStar = {
  title: string;
  why: string;
  lastChangedAt: string;
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
