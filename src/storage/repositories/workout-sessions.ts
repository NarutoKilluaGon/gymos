import { appendEvent } from "@/storage/events";
import {
  readAllDailyActivitiesUnlocked,
  readDailyActivityUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import type { WorkoutSession } from "@/types/gymos";
import { dateKeyFromTimestamp, getTodayKey } from "@/utils/date";

const sessionDate = (session: WorkoutSession): string =>
  session.date ?? dateKeyFromTimestamp(session.startedAt) ?? getTodayKey();

/** Every session, newest first. Legacy sessions get their `date` filled in. */
export async function getAllSessions(): Promise<WorkoutSession[]> {
  const data = await withDailyLock(readAllDailyActivitiesUnlocked);
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

/** The newest session that has not been finished, if any. */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  const all = await getAllSessions();

  return all.find((session) => !session.endedAt) ?? null;
}

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

  const outcome = await withDailyLock(async () => {
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
  });

  if (!outcome.previous) {
    await appendEvent("workout.started", {
      workoutId: saved.id,
      name: saved.name,
      ...(saved.routineId ? { routineId: saved.routineId } : {}),
    });
  }

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

  return saved;
}

export async function deleteSession(id: string): Promise<boolean> {
  const removed = await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const [bucket, activity] of Object.entries(data)) {
      if (!(activity.workouts ?? []).some((item) => item?.id === id)) {
        continue;
      }

      const day = await readDailyActivityUnlocked(bucket);

      day.workouts = day.workouts.filter((item) => item.id !== id);
      await writeDailyActivityUnlocked(day);

      return true;
    }

    return false;
  });

  if (removed) {
    await appendEvent("workout.deleted", { workoutId: id });
  }

  return removed;
}
