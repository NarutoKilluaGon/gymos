import { getAllDailyActivities, getDailyActivity, readDailyActivityUnlocked, withDailyLock, writeDailyActivityUnlocked } from "@/storage/daily";
import { isCompletedWorkout } from "@/services/forge/history";
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
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

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

    await writeDailyActivityUnlocked(activity);

    return workout;
  });

  await appendEvent("workout.started", {
    workoutId: saved.id,
    name,
    ...(routineId ? { routineId } : {}),
  });

  return saved;
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  name: string,
): Promise<WorkoutExercise | undefined> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

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

    await writeDailyActivityUnlocked(activity);

    return exercise;
  });

  if (!saved) {
    return undefined;
  }

  await appendEvent("workout.exercise.added", {
    workoutId,
    exerciseId,
    name,
  });

  return saved;
}

export async function addSetToWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  set: Omit<WorkoutSet, "id">,
): Promise<WorkoutSet | undefined> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

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

    await writeDailyActivityUnlocked(activity);

    return workoutSet;
  });

  if (!saved) {
    return undefined;
  }

  await appendEvent("workout.set.logged", {
    workoutId,
    exerciseId,
    setId: saved.id,
    weight: saved.weight,
    reps: saved.reps,
    unit: saved.unit,
  });

  return saved;
}

export async function addCardioToWorkout(
  workoutId: string,
  input: Omit<CardioEntry, "id" | "loggedAt">,
): Promise<CardioEntry | undefined> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

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

    await writeDailyActivityUnlocked(activity);

    return entry;
  });

  if (!saved) {
    return undefined;
  }

  await appendEvent("workout.cardio.logged", {
    workoutId,
    cardioId: saved.id,
    activity: saved.activity,
    durationMin: saved.durationMin,
    ...(saved.distanceKm !== undefined
      ? { distanceKm: saved.distanceKm }
      : {}),
    ...(saved.calories !== undefined ? { calories: saved.calories } : {}),
  });

  return saved;
}

export async function removeSetFromWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  setId: string,
): Promise<void> {
  await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

    const workout = activity.workouts.find((item) => item.id === workoutId);

    const exercise = workout?.exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) {
      return;
    }

    exercise.sets = exercise.sets.filter((set) => set.id !== setId);

    await writeDailyActivityUnlocked(activity);
  });
}

export async function removeExerciseFromWorkout(
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

    const workout = activity.workouts.find((item) => item.id === workoutId);

    if (!workout) {
      return;
    }

    workout.exercises = workout.exercises.filter(
      (item) => item.id !== exerciseId,
    );

    await writeDailyActivityUnlocked(activity);
  });
}

export async function removeCardioFromWorkout(
  workoutId: string,
  cardioId: string,
): Promise<void> {
  const removed = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

    const workout = activity.workouts.find((item) => item.id === workoutId);

    if (!workout || !Array.isArray(workout.cardio)) {
      return false;
    }

    const before = workout.cardio.length;
    workout.cardio = workout.cardio.filter((entry) => entry.id !== cardioId);

    if (workout.cardio.length === before) {
      return false;
    }

    await writeDailyActivityUnlocked(activity);

    return true;
  });

  // Tombstone so derived views (timeline, calorie target) stop counting
  // the removed entry. Only emitted when something was actually removed.
  if (removed) {
    await appendEvent("workout.cardio.removed", { workoutId, cardioId });
  }
}

export async function finishWorkout(
  workoutId: string,
  notes?: string,
): Promise<WorkoutSession | undefined> {
  const finished = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());

    const workout = activity.workouts.find((item) => item.id === workoutId);

    if (!workout) {
      return undefined;
    }

    workout.endedAt = new Date().toISOString();

    if (notes) {
      workout.notes = notes;
    }

    await writeDailyActivityUnlocked(activity);

    return {
      workout,
      durationMs:
        new Date(workout.endedAt).getTime() -
        new Date(workout.startedAt).getTime(),
    };
  });

  if (!finished) {
    return undefined;
  }

  await appendEvent("workout.finished", {
    workoutId,
    durationMs: finished.durationMs,
    exerciseCount: finished.workout.exercises.length,
    ...(notes ? { notes } : {}),
  });

  return finished.workout;
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
    // "Completed" by the one shared rule (finished AND real work or cardio),
    // not merely finished: a session ended with nothing logged is no workout.
    .filter((workout): workout is WorkoutSession =>
      isCompletedWorkout(workout),
    )
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
}
