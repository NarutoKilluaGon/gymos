import { getAllDailyActivities, getDailyActivity, saveDailyActivity } from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type {
  CardioEntry,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function startWorkout(
  name: string,
  routineId?: string,
): Promise<WorkoutSession> {
  const activity = await getDailyActivity(getTodayKey());

  if (!Array.isArray(activity.workouts)) {
    activity.workouts = [];
  }

  const workout: WorkoutSession = {
    id: createId(),
    name,
    startedAt: new Date().toISOString(),
    exercises: [],
    ...(routineId ? { routineId } : {}),
  };

  activity.workouts.push(workout);

  await saveDailyActivity(activity);

  await appendEvent("workout.started", {
    workoutId: workout.id,
    name,
    ...(routineId ? { routineId } : {}),
  });

  return workout;
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  name: string,
): Promise<WorkoutExercise | undefined> {
  const activity = await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find((item) => item.id === workoutId);

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

  await appendEvent("workout.exercise.added", {
    workoutId,
    exerciseId,
    name,
  });

  return exercise;
}

export async function addSetToWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  set: Omit<WorkoutSet, "id">,
): Promise<WorkoutSet | undefined> {
  const activity = await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return undefined;
  }

  const exercise = workout.exercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    return undefined;
  }

  const workoutSet: WorkoutSet = {
    id: createId(),
    ...set,
  };

  exercise.sets.push(workoutSet);

  await saveDailyActivity(activity);

  await appendEvent("workout.set.logged", {
    workoutId,
    exerciseId,
    setId: workoutSet.id,
    weight: workoutSet.weight,
    reps: workoutSet.reps,
    unit: workoutSet.unit,
  });

  return workoutSet;
}

export async function addCardioToWorkout(
  workoutId: string,
  input: Omit<CardioEntry, "id" | "loggedAt">,
): Promise<CardioEntry | undefined> {
  const activity = await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return undefined;
  }

  const entry: CardioEntry = {
    id: createId(),
    ...input,
    loggedAt: new Date().toISOString(),
  };

  if (!Array.isArray(workout.cardio)) {
    workout.cardio = [];
  }

  workout.cardio.push(entry);

  await saveDailyActivity(activity);

  await appendEvent("workout.cardio.logged", {
    workoutId,
    cardioId: entry.id,
    activity: entry.activity,
    durationMin: entry.durationMin,
    ...(entry.distanceKm !== undefined
      ? { distanceKm: entry.distanceKm }
      : {}),
    ...(entry.calories !== undefined ? { calories: entry.calories } : {}),
  });

  return entry;
}

export async function removeCardioFromWorkout(
  workoutId: string,
  cardioId: string,
): Promise<void> {
  const activity = await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find((item) => item.id === workoutId);

  if (!workout || !Array.isArray(workout.cardio)) {
    return;
  }

  workout.cardio = workout.cardio.filter((entry) => entry.id !== cardioId);

  await saveDailyActivity(activity);
}

export async function finishWorkout(
  workoutId: string,
  notes?: string,
): Promise<WorkoutSession | undefined> {
  const activity = await getDailyActivity(getTodayKey());

  const workout = activity.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return undefined;
  }

  workout.endedAt = new Date().toISOString();

  if (notes) {
    workout.notes = notes;
  }

  await saveDailyActivity(activity);

  await appendEvent("workout.finished", {
    workoutId,
    durationMs:
      new Date(workout.endedAt).getTime() -
      new Date(workout.startedAt).getTime(),
    exerciseCount: workout.exercises.length,
    ...(notes ? { notes } : {}),
  });

  return workout;
}

export async function getTodayWorkouts(): Promise<WorkoutSession[]> {
  const activity = await getDailyActivity(getTodayKey());

  return Array.isArray(activity.workouts) ? activity.workouts : [];
}

export async function getCompletedWorkouts(): Promise<WorkoutSession[]> {
  const data = await getAllDailyActivities();

  return Object.values(data)
    .flatMap((activity) =>
      Array.isArray(activity.workouts) ? activity.workouts : [],
    )
    .filter((workout): workout is WorkoutSession => Boolean(workout?.endedAt))
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
}
