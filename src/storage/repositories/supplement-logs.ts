import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import { getSupplements } from "@/storage/repositories/supplements";
import { getTodayKey } from "@/utils/date";

const SUPPLEMENT_LOGS_KEY = "@gymos/supplement-logs";

type SupplementLogsByDate = Record<
  string, // dateKey, e.g. "2026-09-08"
  Record<string, boolean> // supplementId -> taken
>;

export async function getSupplementLogsForDate(
  dateKey: string = getTodayKey(),
): Promise<Record<string, boolean>> {
  const all =
    (await getStorage<SupplementLogsByDate>(
      SUPPLEMENT_LOGS_KEY,
    )) ?? {};

  return all[dateKey] ?? {};
}

export async function setSupplementTaken(
  dateKey: string,
  supplementId: string,
  taken: boolean,
): Promise<void> {
  const all =
    (await getStorage<SupplementLogsByDate>(
      SUPPLEMENT_LOGS_KEY,
    )) ?? {};

  const logs = all[dateKey] ?? {};

  logs[supplementId] = taken;

  all[dateKey] = logs;

  await setStorage(SUPPLEMENT_LOGS_KEY, all);
}

export type SupplementProgress = {
  total: number;
  taken: number;
};

/**
 * Count how many of today's enabled supplements have been
 * taken. Returns 0/0 when nothing is configured.
 */
export async function getEnabledSupplementProgress(
  dateKey: string = getTodayKey(),
): Promise<SupplementProgress> {
  const supplements = await getSupplements();

  const enabled = supplements.filter((s) => s.enabled);

  if (enabled.length === 0) {
    return { total: 0, taken: 0 };
  }

  const logs = await getSupplementLogsForDate(dateKey);

  const taken = enabled.filter((s) => logs[s.id] === true).length;

  return { total: enabled.length, taken };
}