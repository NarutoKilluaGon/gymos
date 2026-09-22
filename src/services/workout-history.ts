import {
  getCompletedWorkouts,
} from "@/storage/repositories/workouts";
import type {
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";

export function setWeight(weight?: number): number {
  return weight ?? 0;
}

/** Total volume of a workout = Σ weight × reps over completed sets. */
export function workoutVolume(workout: WorkoutSession): number {
  return workout.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce((sum, set) => {
        if (!set.completed) {
          return sum;
        }

        return sum + setWeight(set.weight) * set.reps;
      }, 0),
    0,
  );
}

/** Count of logged (non-empty) sets across the workout. */
export function workoutSetCount(workout: WorkoutSession): number {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
}

export function workoutDurationMin(workout: WorkoutSession): number {
  if (!workout.endedAt) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(workout.endedAt).getTime() -
        new Date(workout.startedAt).getTime()) /
        60_000,
    ),
  );
}

export function formatDuration(min: number): string {
  if (min < 60) {
    return `${min} min`;
  }

  const hours = Math.floor(min / 60);
  const remaining = min % 60;

  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatVolume(value: number): string {
  const rounded = Math.round(value);

  if (rounded >= 1000) {
    return `${(rounded / 1000).toFixed(1)}t`;
  }

  return String(rounded);
}

export function formatSetName(set: WorkoutSet): string {
  if (set.weight === undefined) {
    return `${set.reps} reps`;
  }

  return `${set.weight} ${set.unit ?? "kg"} × ${set.reps}`;
}

export async function getWorkoutHistory(): Promise<WorkoutSession[]> {
  return getCompletedWorkouts();
}