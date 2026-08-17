import type { WaterEntry } from "@/types/gymos";
import {
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import { getTodayKey } from "@/utils/date";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function addWater(
  amountMl: number,
): Promise<WaterEntry> {
  const activity = await getDailyActivity(getTodayKey());

  const entry: WaterEntry = {
    id: createId(),
    amountMl,
    timestamp: new Date().toISOString(),
  };

  activity.water.push(entry);

  await saveDailyActivity(activity);

  return entry;
}

export async function getTodayWater(): Promise<number> {
  const activity = await getDailyActivity(getTodayKey());

  return activity.water.reduce(
    (total, entry) => total + entry.amountMl,
    0,
  );
}
