import { getStorage, setStorage } from "@/storage/storage";

export type ReminderTime = { hour: number; minute: number };

export type ReminderConfig = {
  enabled: boolean;
  time: ReminderTime;
};

export type WaterReminderConfig = {
  enabled: boolean;
  intervalHours: number;
};

export type ReminderPrefs = {
  workout: ReminderConfig;
  meals: ReminderConfig;
  water: WaterReminderConfig;
  streak: ReminderConfig;
};

const REMINDERS_KEY = "@gymos/reminders";

const DEFAULT_PREFS: ReminderPrefs = {
  workout: { enabled: false, time: { hour: 18, minute: 0 } },
  meals: { enabled: false, time: { hour: 12, minute: 30 } },
  water: { enabled: false, intervalHours: 2 },
  streak: { enabled: false, time: { hour: 21, minute: 0 } },
};

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  const stored = await getStorage<ReminderPrefs>(REMINDERS_KEY);

  if (!stored) {
    return DEFAULT_PREFS;
  }

  return {
    workout: { ...DEFAULT_PREFS.workout, ...stored.workout },
    meals: { ...DEFAULT_PREFS.meals, ...stored.meals },
    water: { ...DEFAULT_PREFS.water, ...stored.water },
    streak: { ...DEFAULT_PREFS.streak, ...stored.streak },
  };
}

export async function saveReminderPrefs(
  prefs: ReminderPrefs,
): Promise<void> {
  await setStorage(REMINDERS_KEY, prefs);
}