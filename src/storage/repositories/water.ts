import { appendEvent } from "@/storage/events";
import {
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import type { WaterEntry } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

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

  await appendEvent("water.logged", { amountMl });

  return entry;
}

export async function getTodayWater(): Promise<number> {
  const activity = await getDailyActivity(getTodayKey());

  return activity.water.reduce(
    (total, entry) => total + entry.amountMl,
    0,
  );
}
