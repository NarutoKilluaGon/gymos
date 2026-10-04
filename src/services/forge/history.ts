import { score, workSets, type WeightUnit } from "@/services/forge/load";
import type {
  SessionPr,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { dateKeyFromTimestamp } from "@/utils/date";

/** The local day a session belongs to. */
export function sessionDate(session: WorkoutSession): string {
  return session.date ?? dateKeyFromTimestamp(session.startedAt) ?? "";
}

/** Chronological ordering key: day, then start time. */
export function sortKey(session: WorkoutSession): string {
  const start = new Date(session.startedAt).getTime();

  return `${sessionDate(session)}|${String(Number.isFinite(start) ? start : 0).padStart(14, "0")}`;
}

export const sortSessions = (
  sessions: readonly WorkoutSession[],
): WorkoutSession[] =>
  [...sessions].sort((a, b) => {
    const left = sortKey(a);
    const right = sortKey(b);

    return left < right ? -1 : left > right ? 1 : 0;
  });

export const finishedSessions = (
  sessions: readonly WorkoutSession[],
): WorkoutSession[] =>
  sortSessions(sessions.filter((session) => session.endedAt));

/** Finished sessions strictly before `session`, oldest first. */
export function sessionsBefore(
  sessions: readonly WorkoutSession[],
  session: WorkoutSession,
): WorkoutSession[] {
  const key = sortKey(session);

  return finishedSessions(sessions).filter(
    (other) => other.id !== session.id && sortKey(other) < key,
  );
}

/** Sets from the most recent earlier session that did this exercise. */
export function previousSets(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  session: WorkoutSession,
): {
  session: WorkoutSession;
  exercise: WorkoutExercise;
  sets: WorkoutSet[];
} | null {
  const earlier = sessionsBefore(sessions, session).reverse();

  for (const other of earlier) {
    for (const exercise of other.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;

      const sets = workSets(exercise);

      if (sets.length > 0) return { session: other, exercise, sets };
    }
  }

  return null;
}

/** Every finished performance of an exercise, oldest first. */
export function exerciseHistory(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
): { session: WorkoutSession; exercise: WorkoutExercise }[] {
  return finishedSessions(sessions).flatMap((session) =>
    session.exercises
      .filter(
        (exercise) =>
          exercise.exerciseId === exerciseId && workSets(exercise).length > 0,
      )
      .map((exercise) => ({ session, exercise })),
  );
}

/**
 * Exercises where this session's best set beat everything done before.
 * An exercise with no earlier history can't be a PR (there is nothing to
 * beat), so a first-ever session never reports a false record.
 */
export function detectPrs(
  sessions: readonly WorkoutSession[],
  session: WorkoutSession,
  unit: WeightUnit = "kg",
): SessionPr[] {
  const earlier = sessionsBefore(sessions, session);
  const prs: SessionPr[] = [];

  for (const exercise of session.exercises) {
    const best = [...workSets(exercise)].sort(
      (a, b) => score(session, exercise, b) - score(session, exercise, a),
    )[0];

    if (!best) continue;

    let previousBest = 0;

    for (const other of earlier) {
      for (const done of other.exercises) {
        if (done.exerciseId !== exercise.exerciseId) continue;

        for (const set of workSets(done)) {
          previousBest = Math.max(previousBest, score(other, done, set));
        }
      }
    }

    if (previousBest > 0 && score(session, exercise, best) > previousBest) {
      prs.push({
        exerciseId: exercise.exerciseId,
        weight: best.weight ?? 0,
        reps: best.reps,
        unit: best.unit ?? unit,
      });
    }
  }

  return prs;
}

/** Finished sessions in the window of the last `days` days. */
export function sessionsInLast(
  sessions: readonly WorkoutSession[],
  days: number,
  now: Date,
): WorkoutSession[] {
  return finishedSessions(sessions).filter((session) => {
    const day = new Date(`${sessionDate(session)}T12:00:00`).getTime();

    return (now.getTime() - day) / 86_400_000 < days;
  });
}
