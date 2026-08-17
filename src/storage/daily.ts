import { getStorage, setStorage } from "@/storage/storage";
import { getTodayKey } from "@/utils/date";

export type DailyRecord = {
  water: number;
  sleep?: number;
  steps?: number;
  weight?: number;
  journal?: string;
};

const DAILY_STORAGE_KEY = "@gymos/daily";

type DailyData = Record<string, DailyRecord>;

export async function getDailyRecord(
  dateKey: string = getTodayKey(),
): Promise<DailyRecord> {
  const data =
    (await getStorage<DailyData>(DAILY_STORAGE_KEY)) ?? {};

  return (
    data[dateKey] ?? {
      water: 0,
    }
  );
}

export async function updateDailyRecord(
  updates: Partial<DailyRecord>,
  dateKey: string = getTodayKey(),
): Promise<DailyRecord> {
  const data =
    (await getStorage<DailyData>(DAILY_STORAGE_KEY)) ?? {};

  const current = data[dateKey] ?? {
    water: 0,
  };

  const updated: DailyRecord = {
    ...current,
    ...updates,
  };

  data[dateKey] = updated;

  await setStorage(DAILY_STORAGE_KEY, data);

  return updated;
}
