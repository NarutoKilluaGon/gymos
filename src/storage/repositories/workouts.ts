import {
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import type {
  Measurement,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { getTodayKey } from "@/utils/date";

function createId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export async function startWorkout(
  name: string,
): Promise<WorkoutSession> {
  const activity =
    await getDailyActivity(getTodayKey());

  if (!Array.isArray(activity.workouts)) {
    activity.workouts = [];
  }

  const workout: WorkoutSession = {
    id: createId(),
    name,
    startedAt: new Date().toISOString(),
    exercises: [],
  };

  activity.workouts.push(workout);

  await saveDailyActivity(activity);

  return workout;
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  name: string,
): Promise<WorkoutExercise | undefined> {
  const activity =
    await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find(
    (item) => item.id === workoutId,
  );

  if (!workout) {
    return undefined;
  }

  const exercise: WorkoutExercise = {
    id: createId(),
    exerciseId,
    name,
    sets: [],
  };

  workout.exercises.push(exercise);

  await saveDailyActivity(activity);

  return exercise;
}

export async function addSetToWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  set: Omit<WorkoutSet, "id">,
): Promise<WorkoutSet | undefined> {
  const activity =
    await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find(
    (item) => item.id === workoutId,
  );

  if (!workout) {
    return undefined;
  }

  const exercise = workout.exercises.find(
    (item) => item.id === exerciseId,
  );

  if (!exercise) {
    return undefined;
  }

  const workoutSet: WorkoutSet = {
    id: createId(),
    ...set,
  };

  exercise.sets.push(workoutSet);

  await saveDailyActivity(activity);

  return workoutSet;
}

export async function finishWorkout(
  workoutId: string,
): Promise<WorkoutSession | undefined> {
  const activity =
    await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find(
    (item) => item.id === workoutId,
  );

  if (!workout) {
    return undefined;
  }

  workout.endedAt =
    new Date().toISOString();

  await saveDailyActivity(activity);

  return workout;
}

export async function getTodayWorkouts(): Promise<
  WorkoutSession[]
> {
  const activity =
    await getDailyActivity(getTodayKey());

  return Array.isArray(activity.workouts)
    ? activity.workouts
    : [];
}
