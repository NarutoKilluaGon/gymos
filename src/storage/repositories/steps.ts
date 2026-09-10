import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import { getTodayKey } from "@/utils/date";

const STEPS_KEY = "@gymos/steps";

type StepsStore = Record<string, number>; // dateKey -> step count

export async function getTodaySteps(): Promise<number> {
  const all = (await getStorage<StepsStore>(STEPS_KEY)) ?? {};
  return all[getTodayKey()] ?? 0;
}

export async function setTodaySteps(count: number): Promise<void> {
  const all = (await getStorage<StepsStore>(STEPS_KEY)) ?? {};
  all[getTodayKey()] = Math.max(0, Math.floor(count));
  await setStorage(STEPS_KEY, all);
}

export async function addSteps(delta: number): Promise<number> {
  if (delta === 0) return getTodaySteps();
  const current = await getTodaySteps();
  const next = Math.max(0, current + delta);
  await setTodaySteps(next);
  return next;
}