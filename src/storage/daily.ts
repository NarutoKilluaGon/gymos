import { getStorage, setStorage } from "@/storage/storage";
import type { DailyActivity, WaterEntry } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";

const DAILY_STORAGE_KEY = "@gymos/daily";

type DailyData = Record<string, DailyActivity>;

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

function createId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
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

  return activity;
}

export async function getDailyActivity(
  dateKey: string = getTodayKey(),
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

export async function saveDailyActivity(
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

