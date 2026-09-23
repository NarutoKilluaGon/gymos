import { DAILY_STORAGE_KEY, type DailyData } from "@/storage/constants";
import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { DailyActivity, WaterEntry } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

type LegacyDailyRecord = {
  water: number;
  sleep?: number;
  steps?: number;
  weight?: number;
  journal?: string;
};

type StoredDailyData = Record<
  string,
  DailyActivity | LegacyDailyRecord
>;

/**
 * Serializes every read → modify → write transaction against the
 * `@gymos/daily` key. Each operation snapshots the whole store, so
 * without this lock two overlapping operations would each persist
 * their own stale snapshot and silently drop the other's changes.
 */
const dailyMutex = createMutex();

/**
 * Run `task` with exclusive access to the daily store.
 *
 * The lock is held for the task's entire lifetime — its reads, its
 * mutations and its write all happen before any other transaction
 * can start. The task's result or error is passed through to the
 * caller unchanged, and the lock is always released before that
 * outcome is delivered, so a failed operation never blocks the next.
 *
 * NOT re-entrant: never call `getDailyActivity`, `saveDailyActivity`
 * or `getAllDailyActivities` from inside `task` — use the
 * `...Unlocked` helpers instead, or the queue deadlocks on itself.
 */
export function withDailyLock<T>(
  task: () => Promise<T>,
): Promise<T> {
  return dailyMutex.runExclusive(task);
}

function createEmptyDailyActivity(
  date: string,
): DailyActivity {
  return {
    date,
    water: [],
    workouts: [],
    meals: [],
    sleep: [],
    measurements: [],
    journal: [],
  };
}

function isLegacyRecord(
  record: DailyActivity | LegacyDailyRecord,
): record is LegacyDailyRecord {
  return (
    "water" in record &&
    typeof record.water === "number"
  );
}

function migrateRecord(
  date: string,
  record: DailyActivity | LegacyDailyRecord,
): DailyActivity {
  if (!isLegacyRecord(record)) {
    return record;
  }

  const activity = createEmptyDailyActivity(date);

  if (record.water > 0) {
    const waterEntry: WaterEntry = {
      id: createId(),
      amountMl: record.water * 1000,
      timestamp: new Date(`${date}T12:00:00`).toISOString(),
    };

    activity.water.push(waterEntry);
  }

  const migratedWater = activity.water;

  // Preserve every legacy field (sleep, steps, weight, journal) instead of
  // dropping it; `record.water` is a bare number, so re-apply the migrated
  // WaterEntry[] captured above.
  return Object.assign(activity, record, { water: migratedWater });
}

/**
 * Read one day's activity, migrating a legacy record in place and
 * persisting the migration.
 *
 * Caller must already hold the daily lock (see `withDailyLock`).
 */
export async function readDailyActivityUnlocked(
  dateKey: string,
): Promise<DailyActivity> {
  const stored =
    (await getStorage<StoredDailyData>(
      DAILY_STORAGE_KEY,
    )) ?? {};

  const rawRecord = stored[dateKey];

  if (!rawRecord) {
    return createEmptyDailyActivity(dateKey);
  }

  const activity = migrateRecord(
    dateKey,
    rawRecord,
  );

  if (activity !== rawRecord) {
    const migratedData = stored as DailyData;

    migratedData[dateKey] = activity;

    await setStorage(
      DAILY_STORAGE_KEY,
      migratedData,
    );
  }

  return activity;
}

/**
 * Persist a single day's activity.
 *
 * Caller must already hold the daily lock (see `withDailyLock`).
 */
export async function writeDailyActivityUnlocked(
  activity: DailyActivity,
): Promise<void> {
  const data =
    (await getStorage<DailyData>(
      DAILY_STORAGE_KEY,
    )) ?? {};

  data[activity.date] = activity;

  await setStorage(
    DAILY_STORAGE_KEY,
    data,
  );
}

/**
 * Load the full daily store, migrating any legacy records
 * in place. Repositories that query across days should use
 * this instead of reading raw storage so migration logic
 * is never bypassed. Migration is applied in memory only —
 * nothing is written back.
 *
 * Caller must already hold the daily lock (see `withDailyLock`).
 */
export async function readAllDailyActivitiesUnlocked(): Promise<DailyData> {
  const stored =
    (await getStorage<StoredDailyData>(
      DAILY_STORAGE_KEY,
    )) ?? {};

  const data: DailyData = {};

  for (const [dateKey, rawRecord] of Object.entries(
    stored,
  )) {
    data[dateKey] = migrateRecord(
      dateKey,
      rawRecord,
    );
  }

  return data;
}

export async function getDailyActivity(
  dateKey: string = getTodayKey(),
): Promise<DailyActivity> {
  return withDailyLock(() =>
    readDailyActivityUnlocked(dateKey),
  );
}

export async function saveDailyActivity(
  activity: DailyActivity,
): Promise<void> {
  return withDailyLock(() =>
    writeDailyActivityUnlocked(activity),
  );
}

export async function getAllDailyActivities(): Promise<DailyData> {
  return withDailyLock(() =>
    readAllDailyActivitiesUnlocked(),
  );
}

