import {
  getAllDailyActivities,
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type { SleepSession } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function startSleep(): Promise<SleepSession> {
  const activity = await getDailyActivity(getTodayKey());

  const startedAt = new Date().toISOString();

  const session: SleepSession = {
    id: createId(),
    startedAt,
  };

  if (!Array.isArray(activity.sleep)) {
    activity.sleep = [];
  }

  activity.sleep.push(session);

  await saveDailyActivity(activity);

  await appendEvent("sleep.started", {
    sleepId: session.id,
    startedAt,
  });

  return session;
}

export async function endSleep(
  sleepId: string,
): Promise<SleepSession | undefined> {
  const activity = await getDailyActivity(getTodayKey());

  const session = activity.sleep.find(
    (item) => item.id === sleepId,
  );

  if (!session || session.endedAt) {
    return undefined;
  }

  session.endedAt = new Date().toISOString();

  await saveDailyActivity(activity);

  await appendEvent("sleep.ended", {
    sleepId,
    durationMs:
      new Date(session.endedAt).getTime() -
      new Date(session.startedAt).getTime(),
  });

  return session;
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

  const activity = await getDailyActivity(getTodayKey());

  const session: SleepSession = {
    id: createId(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };

  if (!Array.isArray(activity.sleep)) {
    activity.sleep = [];
  }

  activity.sleep.push(session);

  await saveDailyActivity(activity);

  await appendEvent("sleep.ended", {
    sleepId: session.id,
    durationMs,
  });

  return session;
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