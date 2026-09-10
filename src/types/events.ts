import type { ID, Timestamp } from "@/types/gymos";

/**
 * Every user action is recorded as an append-only event.
 * Events are permanent by design — there is no "deleted" type.
 */
export type EventType =
  | "water.logged"
  | "workout.started"
  | "workout.exercise.added"
  | "workout.set.logged"
  | "workout.cardio.logged"
  | "workout.finished"
  | "routine.created"
  | "routine.updated"
  | "routine.deleted"
  | "routine.duplicated"
  | "meal.logged"
  | "sleep.started"
  | "sleep.ended"
  | "measurement.logged"
  | "journal.logged"
  | "weight.logged"
  | "northstar.changed";

/**
 * Typed payload for each event variant.
 * Payloads carry summary data, not full entities — events
 * are for history and insights, not as a source of truth.
 */
export type EventPayload = {
  "water.logged": { amountMl: number };
  "workout.started": { workoutId: ID; name: string; routineId?: ID };
  "workout.exercise.added": {
    workoutId: ID;
    exerciseId: ID;
    name: string;
  };
  "workout.set.logged": {
    workoutId: ID;
    exerciseId: ID;
    setId: ID;
    weight?: number;
    reps: number;
    unit?: "kg" | "lb";
  };
  "workout.cardio.logged": {
    workoutId: ID;
    cardioId: ID;
    activity: string;
    durationMin: number;
    distanceKm?: number;
    calories?: number;
  };
  "workout.finished": {
    workoutId: ID;
    durationMs: number;
    exerciseCount: number;
    notes?: string;
  };
  "routine.created": {
    routineId: ID;
    name: string;
    exerciseCount: number;
  };
  "routine.updated": {
    routineId: ID;
    name: string;
    exerciseCount: number;
  };
  "routine.deleted": {
    routineId: ID;
    name: string;
    exerciseCount: number;
  };
  "routine.duplicated": {
    routineId: ID;
    sourceRoutineId: ID;
    name: string;
    exerciseCount: number;
  };
  "meal.logged": {
    mealId: ID;
    name: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  "sleep.started": { sleepId: ID; startedAt: Timestamp };
  "sleep.ended": { sleepId: ID; durationMs: number };
  "measurement.logged": {
    measurementId: ID;
    type: string;
    value: number;
    unit: string;
  };
  "journal.logged": { journalId: ID; textLength: number };
  "weight.logged": { weight: number; unit: string };
  "northstar.changed": {
    previousTitle?: string;
    newTitle: string;
  };
};

export type AppEvent<T extends EventType = EventType> = {
  id: ID;
  type: T;
  timestamp: Timestamp;
  payload: EventPayload[T];
};