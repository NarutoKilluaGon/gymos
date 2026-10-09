import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { createId } from "@/utils/id";

/** Mark the session as just edited (drives idle-time trimming). */
export const touch = (session: WorkoutSession, now: Date): WorkoutSession => ({
  ...session,
  lastActivityAt: now.toISOString(),
});

function mapExercise(
  session: WorkoutSession,
  index: number,
  change: (exercise: WorkoutExercise) => WorkoutExercise,
): WorkoutSession {
  if (!session.exercises[index]) return session;

  return {
    ...session,
    exercises: session.exercises.map((exercise, i) =>
      i === index ? change(exercise) : exercise,
    ),
  };
}

function mapSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  change: (set: WorkoutSet) => WorkoutSet,
): WorkoutSession {
  return mapExercise(session, exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, i) => (i === setIndex ? change(set) : set)),
  }));
}

/** True when exercise `index` is linked to the NEXT one in a superset. */
export function isSupersetLeader(
  session: WorkoutSession,
  index: number,
): boolean {
  const current = session.exercises[index];
  const next = session.exercises[index + 1];

  return Boolean(current?.group && next?.group === current.group);
}

export type ToggleResult = {
  session: WorkoutSession;
  /** The set just became done, so a rest timer should start. */
  startRest: boolean;
};

/**
 * Tick or untick a set. Completing a set on a paused session resumes the
 * clock (you're clearly training), and starts rest unless the session is
 * finished or the exercise is mid-superset.
 */
export function toggleSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  now: Date,
): ToggleResult {
  const set = session.exercises[exerciseIndex]?.sets[setIndex];

  if (!set) return { session, startRest: false };

  const becomesDone = !set.completed;
  let next = mapSet(session, exerciseIndex, setIndex, (value) => ({
    ...value,
    completed: becomesDone,
  }));

  if (becomesDone && next.pausedAt && !next.endedAt) {
    const pausedFor = now.getTime() - new Date(next.pausedAt).getTime();

    next = {
      ...next,
      pausedMs: (next.pausedMs ?? 0) + Math.max(0, pausedFor),
    };
    delete next.pausedAt;
  }

  return {
    session: touch(next, now),
    startRest:
      becomesDone && !next.endedAt && !isSupersetLeader(next, exerciseIndex),
  };
}

export const toggleWarmup = (
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  now: Date,
): WorkoutSession =>
  touch(
    mapSet(session, exerciseIndex, setIndex, (set) => ({
      ...set,
      warmup: !set.warmup,
    })),
    now,
  );

export const setSetValues = (
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  values: { weight?: number; reps?: number },
  now: Date,
): WorkoutSession =>
  touch(
    mapSet(session, exerciseIndex, setIndex, (set) => ({
      ...set,
      ...(values.weight !== undefined ? { weight: values.weight } : {}),
      ...(values.reps !== undefined ? { reps: values.reps } : {}),
    })),
    now,
  );

/** Add a set copying the last one's load and reps (not done). */
export function addSet(
  session: WorkoutSession,
  exerciseIndex: number,
  now: Date,
  newId: () => string = createId,
): WorkoutSession {
  return touch(
    mapExercise(session, exerciseIndex, (exercise) => {
      const last = exercise.sets[exercise.sets.length - 1];

      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            id: newId(),
            reps: last?.reps ?? 8,
            weight: last?.weight ?? 0,
            ...(last?.unit ? { unit: last.unit } : {}),
            completed: false,
          },
        ],
      };
    }),
    now,
  );
}

export const removeSet = (
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  now: Date,
): WorkoutSession =>
  touch(
    mapExercise(session, exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((_, i) => i !== setIndex),
    })),
    now,
  );

/** Reinsert a set at its original index. */
export const reinsertSet = (
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  set: WorkoutSet,
  now: Date,
): WorkoutSession =>
  touch(
    mapExercise(session, exerciseIndex, (exercise) => {
      const sets = [...exercise.sets];
      const targetIndex = Math.max(0, Math.min(setIndex, sets.length));
      sets.splice(targetIndex, 0, set);
      return { ...exercise, sets };
    }),
    now,
  );

/** Groups need two neighbours; clear any that no longer have them. */
export function dropOrphanGroups(
  exercises: readonly WorkoutExercise[],
): WorkoutExercise[] {
  return exercises.map((exercise, index) => {
    if (!exercise.group) return exercise;

    const partner =
      exercises[index - 1]?.group === exercise.group ||
      exercises[index + 1]?.group === exercise.group;

    if (partner) return exercise;

    const { group, ...rest } = exercise;

    void group;

    return rest;
  });
}

/** Remove an exercise; a superset partner left alone loses its group. */
export function removeExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  now: Date,
): WorkoutSession {
  const exercises = session.exercises.filter((_, i) => i !== exerciseIndex);

  return touch({ ...session, exercises: dropOrphanGroups(exercises) }, now);
}

/** Reinsert an exercise at its original index. */
export function reinsertExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  exercise: WorkoutExercise,
  now: Date,
): WorkoutSession {
  const exercises = [...session.exercises];
  const targetIndex = Math.max(0, Math.min(exerciseIndex, exercises.length));
  exercises.splice(targetIndex, 0, exercise);
  return touch({ ...session, exercises: dropOrphanGroups(exercises) }, now);
}

/** Swap an exercise with the one above it. */
export function moveExerciseUp(
  session: WorkoutSession,
  exerciseIndex: number,
  now: Date,
): WorkoutSession {
  if (exerciseIndex <= 0 || exerciseIndex >= session.exercises.length) {
    return session;
  }

  const exercises = [...session.exercises];
  const above = exercises[exerciseIndex - 1];
  const current = exercises[exerciseIndex];

  if (!above || !current) return session;

  exercises[exerciseIndex - 1] = current;
  exercises[exerciseIndex] = above;

  return touch({ ...session, exercises: dropOrphanGroups(exercises) }, now);
}

/** Link/unlink an exercise with the next one as a superset. */
export function toggleSuperset(
  session: WorkoutSession,
  exerciseIndex: number,
  now: Date,
  newId: () => string = createId,
): WorkoutSession {
  const a = session.exercises[exerciseIndex];
  const b = session.exercises[exerciseIndex + 1];

  if (!a || !b) return session;

  const exercises = session.exercises.map((exercise) => ({ ...exercise }));
  const left = exercises[exerciseIndex];
  const right = exercises[exerciseIndex + 1];

  if (!left || !right) return session;

  if (a.group && a.group === b.group) {
    delete right.group;

    if (exercises[exerciseIndex - 1]?.group !== a.group) delete left.group;
  } else {
    const group = a.group ?? newId();

    left.group = group;
    right.group = group;
  }

  return touch({ ...session, exercises }, now);
}

/** exerciseIndex -1 edits the session note. */
export function setNote(
  session: WorkoutSession,
  exerciseIndex: number,
  note: string,
  now: Date,
): WorkoutSession {
  const text = note.trim();

  if (exerciseIndex < 0) {
    const { notes, ...rest } = session;

    void notes;

    return touch(text ? { ...rest, notes: text } : rest, now);
  }

  return touch(
    mapExercise(session, exerciseIndex, (exercise) => {
      const { note: oldNote, ...rest } = exercise;

      void oldNote;

      return text ? { ...rest, note: text } : rest;
    }),
    now,
  );
}

export const appendExercise = (
  session: WorkoutSession,
  exercise: WorkoutExercise,
  now: Date,
): WorkoutSession =>
  touch({ ...session, exercises: [...session.exercises, exercise] }, now);

/** Replace an exercise's identity but keep its sets. */
export const swapExercise = (
  session: WorkoutSession,
  exerciseIndex: number,
  replacement: {
    exerciseId: string;
    name: string;
    bodyweight: boolean;
    tip?: string;
  },
  now: Date,
): WorkoutSession =>
  touch(
    mapExercise(session, exerciseIndex, (exercise) => {
      const { tip, bodyweight, progressed, ...rest } = exercise;

      void tip;
      void bodyweight;
      void progressed;

      return {
        ...rest,
        exerciseId: replacement.exerciseId,
        name: replacement.name,
        ...(replacement.bodyweight ? { bodyweight: true } : {}),
        ...(replacement.tip ? { tip: replacement.tip } : {}),
      };
    }),
    now,
  );

/** Done and total set counts (warm-ups excluded from both). */
export function setCounts(session: WorkoutSession): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.warmup) continue;

      total += 1;

      if (set.completed) done += 1;
    }
  }

  return { done, total };
}
