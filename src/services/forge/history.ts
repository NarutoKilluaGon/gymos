import {
  bestSet,
  score,
  workSets,
  type WeightUnit,
} from "@/services/forge/load";
import type {
  PersonalRecord,
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

/** Best score any of these sessions reached on an exercise (0 = none). */
function bestScoreOn(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
): number {
  let best = 0;

  for (const other of sessions) {
    for (const done of other.exercises) {
      if (done.exerciseId !== exerciseId) continue;

      for (const set of workSets(done)) {
        best = Math.max(best, score(other, done, set));
      }
    }
  }

  return best;
}

/**
 * Exercises where this session's best set beat everything done before.
 * An exercise with no earlier history can't be a PR (there is nothing to
 * beat), so a first-ever session never reports a false record. Its best set
 * still becomes the stored record: see `personalRecords`.
 */
export function detectPrs(
  sessions: readonly WorkoutSession[],
  session: WorkoutSession,
  unit: WeightUnit = "kg",
): SessionPr[] {
  const earlier = sessionsBefore(sessions, session);
  const prs: SessionPr[] = [];

  for (const exercise of session.exercises) {
    const best = bestSet(session, exercise);

    if (!best) continue;

    const previousBest = bestScoreOn(earlier, exercise.exerciseId);

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

/**
 * The stored "best set per exercise", derived from finished sessions with
 * the same scoring as `detectPrs`. Deriving it (rather than patching it as
 * sessions finish) means the first qualifying performance of an exercise is
 * recorded, a lower or backdated session can never replace a better one, and
 * deleting or reopening a session drops whatever record only it held.
 * Ties keep the earliest performance.
 */
export function personalRecords(
  sessions: readonly WorkoutSession[],
  unit: WeightUnit = "kg",
): Record<string, PersonalRecord> {
  const best: Record<string, { points: number; record: PersonalRecord }> = {};

  for (const session of finishedSessions(sessions)) {
    for (const exercise of session.exercises) {
      const set = bestSet(session, exercise);

      if (!set) continue;

      const points = score(session, exercise, set);

      if (points <= 0) continue;

      const current = best[exercise.exerciseId];

      if (current && points <= current.points) continue;

      best[exercise.exerciseId] = {
        points,
        record: {
          exerciseId: exercise.exerciseId,
          weight: set.weight ?? 0,
          reps: set.reps,
          unit: set.unit ?? unit,
          timestamp: session.endedAt ?? session.startedAt,
        },
      };
    }
  }

  return Object.fromEntries(
    Object.entries(best).map(([id, entry]) => [id, entry.record]),
  );
}

const samePrs = (a: readonly SessionPr[], b: readonly SessionPr[]): boolean => {
  const key = (list: readonly SessionPr[]) =>
    JSON.stringify(
      [...list].sort((x, y) => x.exerciseId.localeCompare(y.exerciseId)),
    );

  return key(a) === key(b);
};

/**
 * Corrected `prs` for finished sessions that come after a session which was
 * deleted, reopened or just finished. A record is judged against everything
 * before it, so changing the past can add or remove later records. Only the
 * given exercises are re-judged and only changed sessions are returned.
 */
export function recomputeSessionPrs(
  sessions: readonly WorkoutSession[],
  after: string,
  exerciseIds: ReadonlySet<string>,
): Map<string, SessionPr[]> {
  const changes = new Map<string, SessionPr[]>();

  if (exerciseIds.size === 0) return changes;

  for (const session of finishedSessions(sessions)) {
    if (sortKey(session) <= after) continue;
    if (!session.exercises.some((e) => exerciseIds.has(e.exerciseId))) continue;

    const current = session.prs ?? [];
    const next = [
      ...current.filter((pr) => !exerciseIds.has(pr.exerciseId)),
      ...detectPrs(sessions, session)
        .filter((pr) => exerciseIds.has(pr.exerciseId))
        // Still a record: keep what was stamped rather than rewrite it.
        .map(
          (pr) =>
            current.find((old) => old.exerciseId === pr.exerciseId) ?? pr,
        ),
    ];

    if (!samePrs(current, next)) changes.set(session.id, next);
  }

  return changes;
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
