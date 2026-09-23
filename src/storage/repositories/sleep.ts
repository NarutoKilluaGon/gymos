import {
  getAllDailyActivities,
  getDailyActivity,
  readAllDailyActivitiesUnlocked,
  readDailyActivityUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type { SleepSession } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function startSleep(): Promise<SleepSession> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    const startedAt = new Date().toISOString();

    const session: SleepSession = {
      id: createId(),
      startedAt,
    };

    if (!Array.isArray(activity.sleep)) {
      activity.sleep = [];
    }

    activity.sleep.push(session);

    await writeDailyActivityUnlocked(activity);

    return session;
  });

  await appendEvent("sleep.started", {
    sleepId: saved.id,
    startedAt: saved.startedAt,
  });

  return saved;
}

export async function endSleep(
  sleepId: string,
): Promise<SleepSession | undefined> {
  const ended = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    const session = activity.sleep.find(
      (item) => item.id === sleepId,
    );

    if (!session || session.endedAt) {
      return undefined;
    }

    session.endedAt = new Date().toISOString();

    await writeDailyActivityUnlocked(activity);

    return {
      session,
      durationMs:
        new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime(),
    };
  });

  if (!ended) {
    return undefined;
  }

  await appendEvent("sleep.ended", {
    sleepId,
    durationMs: ended.durationMs,
  });

  return ended.session;
}

/**
 * Log a completed sleep session of a given duration,
 * ending "now". Used by the quick-add sheet.
 */
export async function logSleepDuration(
  hours: number,
  minutes: number,
): Promise<SleepSession> {
  const durationMs =
    (hours * 60 + minutes) * 60 * 1000;

  const endedAt = new Date();
  const startedAt = new Date(
    endedAt.getTime() - durationMs,
  );

  const saved = await withDailyLock(async () => {
    const store = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    const session: SleepSession = {
      id: createId(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };

    if (!Array.isArray(store.sleep)) {
      store.sleep = [];
    }

    store.sleep.push(session);

    await writeDailyActivityUnlocked(store);

    return session;
  });

  await appendEvent("sleep.ended", {
    sleepId: saved.id,
    durationMs,
  });

  return saved;
}

export async function deleteSleepSession(
  sleepId: string,
): Promise<void> {
  const deleted = await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const activity of Object.values(data)) {
      if (!Array.isArray(activity.sleep)) {
        continue;
      }

      if (!activity.sleep.some((item) => item.id === sleepId)) {
        continue;
      }

      activity.sleep = activity.sleep.filter(
        (item) => item.id !== sleepId,
      );

      await writeDailyActivityUnlocked(activity);
      return true;
    }

    return false;
  });

  if (deleted) {
    await appendEvent("sleep.deleted", { sleepId });
  }
}

export async function getTodaySleep(): Promise<SleepSession[]> {
  const activity = await getDailyActivity(getTodayKey());

  return Array.isArray(activity.sleep)
    ? activity.sleep
    : [];
}

export async function getAllSleep(): Promise<SleepSession[]> {
  const data = await getAllDailyActivities();

  return Object.values(data)
    .flatMap((activity) =>
      Array.isArray(activity.sleep)
        ? activity.sleep
        : [],
    )
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() -
        new Date(a.startedAt).getTime(),
    );
}