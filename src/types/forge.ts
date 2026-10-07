import type { MuscleGroup } from "@/data/exercises";

/** One exercise in a plan day. `weight` is in kg whatever the display unit. */
export type PlanExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  /** Rep target as text, e.g. "8-10" or "5". */
  reps: string;
  weight: number;
  tip?: string;
  /** Linked with the NEXT exercise as a superset. */
  superset?: boolean;
};

export type PlanDay = {
  id: string;
  name: string;
  exercises: PlanExercise[];
};

export type Plan = {
  id: string;
  name: string;
  days: PlanDay[];
  /** Weekday ("0" = Sunday … "6") to day id. Used when `rotate` is off. */
  schedule: Record<string, string>;
  /** Cycle through days in order instead of using weekdays. */
  rotate: boolean;
  /** Deload week: fewer sets, lighter loads. */
  deload: boolean;
  updatedAt: string;
};

export type ForgeSettings = {
  plans: Plan[];
  activePlanId: string;
  /** Rest timer length after a completed set, seconds. 0 turns it off. */
  restSeconds: number;
  /** Barbell weight for the plate calculator, kg. */
  barKg: number;
  /** Routines from the old Workouts screen were turned into a plan. */
  routinesImported: boolean;
};

export type CustomExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  bodyweight: boolean;
};

/** An exercise as the Forge screens use it, from any source. */
export type CatalogExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  bodyweight: boolean;
  secondary?: string;
  how?: string;
  custom?: boolean;
};
