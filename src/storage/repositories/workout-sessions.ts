import {
  personalRecords,
  recomputeSessionPrs,
  sortKey,
} from "@/services/forge/history";
import type { DailyData } from "@/storage/constants";
import { appendEvent } from "@/storage/events";
import { createMutex } from "@/storage/mutex";
import { getWeightUnit } from "@/storage/repositories/preferences";
import { replaceAllPRs } from "@/storage/repositories/prs";
import {
  readAllDailyActivitiesUnlocked,
  readDailyActivityUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import type { SessionPr, WorkoutSession } from "@/types/gymos";
import { dateKeyFromTimestamp, getTodayKey } from "@/utils/date";

const sessionDate = (session: WorkoutSession): string =>
  session.date ?? dateKeyFromTimestamp(session.startedAt) ?? getTodayKey();

/** Every session in `data`, newest first. Legacy sessions get their `date` filled in. */
function sessionsFrom(data: DailyData): WorkoutSession[] {
  const all: WorkoutSession[] = [];

  for (const [bucket, activity] of Object.entries(data)) {
    if (!Array.isArray(activity.workouts)) continue;

    for (const workout of activity.workouts) {
      if (!workout || typeof workout !== "object") continue;

      all.push(workout.date ? workout : { ...workout, date: bucket });
    }
  }

  return all.sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

/** Every session, newest first. Legacy sessions get their `date` filled in. */
export async function getAllSessions(): Promise<WorkoutSession[]> {
  return sessionsFrom(await withDailyLock(readAllDailyActivitiesUnlocked));
}

/** Keeps two PR re-derivations from interleaving; each reads fresh data. */
const prStateMutex = createMutex();

/** Overwrite `prs` on stored sessions, touching nothing else on them. */
async function applyPrFlags(changes: Map<string, SessionPr[]>): Promise<void> {
  await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const [bucket, activity] of Object.entries(data)) {
      if (!(activity.workouts ?? []).some((item) => changes.has(item?.id))) {
        continue;
      }

      const day = await readDailyActivityUnlocked(bucket);

      day.workouts = day.workouts.map((item) =>
        changes.has(item.id)
          ? { ...item, prs: changes.get(item.id) ?? [] }
          : item,
      );
      await writeDailyActivityUnlocked(day);
    }
  });
}

/**
 * PR state is derived from finished sessions, so it must be re-derived
 * whenever one finishes, is reopened or is deleted: the stored record book,
 * plus the record flags of later sessions that were judged against it.
 * Best-effort like the PR store always was: the workout change that
 * triggered this has already been saved and must not report as failed.
 */
async function reconcilePrState(
  changed: readonly WorkoutSession[],
  edited?: string,
): Promise<void> {
  const exerciseIds = new Set(
    changed.flatMap((session) => session.exercises.map((e) => e.exerciseId)),
  );
  const after = changed.map(sortKey).sort()[0] ?? "";

  try {
    await prStateMutex.runExclusive(async () => {
      const sessions = await getAllSessions();
      const flags = recomputeSessionPrs(sessions, after, exerciseIds, edited);

      if (flags.size > 0) await applyPrFlags(flags);

      await replaceAllPRs(personalRecords(sessions, await getWeightUnit()));
    });
  } catch {
    // Re-derived again on the next finish, reopen or delete.
  }
}

/** The newest session that has not been finished, if any. */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  const all = await getAllSessions();

  return all.find((session) => !session.endedAt) ?? null;
}

/**
 * The locked part of `saveSession`: move/replace/insert `saved` in the daily
 * store. Caller must already hold the daily lock (see `withDailyLock`).
 */
async function writeSessionUnlocked(
  saved: WorkoutSession,
): Promise<{ previous: WorkoutSession | undefined }> {
  const date = saved.date ?? sessionDate(saved);
  const data = await readAllDailyActivitiesUnlocked();
  let previous: WorkoutSession | undefined;
  let previousBucket: string | undefined;

  for (const [bucket, activity] of Object.entries(data)) {
    const found = (activity.workouts ?? []).find(
      (item) => item?.id === saved.id,
    );

    if (found) {
      previous = found;
      previousBucket = bucket;
      break;
    }
  }

  if (previousBucket && previousBucket !== date) {
    const old = await readDailyActivityUnlocked(previousBucket);

    old.workouts = old.workouts.filter((item) => item.id !== saved.id);
    await writeDailyActivityUnlocked(old);
  }

  const activity = await readDailyActivityUnlocked(date);
  const index = activity.workouts.findIndex((item) => item.id === saved.id);

  if (index >= 0) {
    activity.workouts[index] = saved;
  } else {
    activity.workouts.push(saved);
  }

  await writeDailyActivityUnlocked(activity);

  return { previous };
}

const appendStarted = (saved: WorkoutSession) =>
  appendEvent("workout.started", {
    workoutId: saved.id,
    name: saved.name,
    ...(saved.routineId ? { routineId: saved.routineId } : {}),
  });

/**
 * Insert or replace a session (matched by id, in any day). The day bucket
 * follows `session.date`. Events are appended once: `workout.started` the
 * first time the id is seen, `workout.finished` the first time `endedAt`
 * appears.
 */
export async function saveSession(
  session: WorkoutSession,
): Promise<WorkoutSession> {
  const date = sessionDate(session);
  const saved: WorkoutSession = { ...session, date };

  const outcome = await withDailyLock(() => writeSessionUnlocked(saved));

  if (!outcome.previous) await appendStarted(saved);

  if (saved.endedAt && !outcome.previous?.endedAt) {
    await appendEvent("workout.finished", {
      workoutId: saved.id,
      durationMs:
        saved.durationMs ??
        Math.max(
          0,
          new Date(saved.endedAt).getTime() -
            new Date(saved.startedAt).getTime(),
        ),
      exerciseCount: saved.exercises.length,
      ...(saved.notes ? { notes: saved.notes } : {}),
    });
  }

  // Finishing or reopening changes what counts as history. So does editing a
  // session that is already finished (its sets, exercises or day): its own
  // records and those of later sessions must be re-derived too.
  if (Boolean(saved.endedAt) !== Boolean(outcome.previous?.endedAt)) {
    await reconcilePrState(
      outcome.previous ? [outcome.previous, saved] : [saved],
    );
  } else if (saved.endedAt && outcome.previous) {
    await reconcilePrState([outcome.previous, saved], saved.id);
  }

  return saved;
}

/**
 * Start a new session unless one is already running. The check and the
 * insert happen under one daily lock, so any number of concurrent calls
 * (a double-tapped Start, two screens) leave exactly one unfinished session:
 * the first creates `session`, the rest get that same running session back
 * with `created: false` and write nothing. `session` must be unfinished.
 */
export async function createSessionIfNoneActive(
  session: WorkoutSession,
): Promise<{ session: WorkoutSession; created: boolean }> {
  const date = sessionDate(session);
  const saved: WorkoutSession = { ...session, date };

  const outcome = await withDailyLock(async () => {
    const running = sessionsFrom(await readAllDailyActivitiesUnlocked()).find(
      (item) => !item.endedAt,
    );

    if (running) return { session: running, created: false };

    await writeSessionUnlocked(saved);

    return { session: saved, created: true };
  });

  if (outcome.created) await appendStarted(saved);

  return outcome;
}

export async function deleteSession(id: string): Promise<boolean> {
  const removed = await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const [bucket, activity] of Object.entries(data)) {
      const found = (activity.workouts ?? []).find((item) => item?.id === id);

      if (!found) {
        continue;
      }

      const day = await readDailyActivityUnlocked(bucket);

      day.workouts = day.workouts.filter((item) => item.id !== id);
      await writeDailyActivityUnlocked(day);

      return found;
    }

    return null;
  });

  if (removed) {
    await appendEvent("workout.deleted", { workoutId: id });

    // An unfinished session was never history, so nothing derives from it.
    if (removed.endedAt) await reconcilePrState([removed]);
  }

  return removed !== null;
}
