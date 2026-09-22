/**
 * Local notification reminders, fully offline (no remote push).
 *
 * Uses lazy dynamic import of expo-notifications so the entire module
 * degrades gracefully on Expo Go (SDK 53+ removed push support there).
 * All exported functions are safe no-ops when the module can't load.
 */

import { Platform } from "react-native";

import type {
  ReminderConfig,
  ReminderPrefs,
  WaterReminderConfig,
} from "@/storage/repositories/reminders";

export type ReminderKind = "workout" | "meals" | "water" | "streak";

export const REMINDER_KINDS: ReminderKind[] = [
  "workout",
  "meals",
  "water",
  "streak",
];

const CHANNEL_ID = "default";

const NOTIFICATION_ID = (kind: ReminderKind) =>
  `gymos-reminder-${kind}`;

const CONTENT: Record<ReminderKind, { title: string; body: string }> = {
  workout: {
    title: "Time to train",
    body: "A quick nudge for today's workout. Show up.",
  },
  meals: {
    title: "Time for a meal",
    body: "Don't forget to log what you eat.",
  },
  water: {
    title: "Drink water",
    body: "Hydration is key. Log a glass.",
  },
  streak: {
    title: "Keep the streak alive",
    body: "Log something today to stay consistent.",
  },
};

let Notifications: any = null;
let loadAttempted = false;

async function loadModule(): Promise<boolean> {
  if (loadAttempted) return Notifications !== null;
  loadAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require("expo-notifications");
    return true;
  } catch {
    return false;
  }
}

let handlerSet = false;

/** Show banners while the app is foregrounded, no sound. */
function setForegroundHandler(): void {
  if (handlerSet || !Notifications) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ensure the Android notification channel exists (required on Android 13+). */
export async function setupNotifications(): Promise<void> {
  if (!(await loadModule())) return;

  setForegroundHandler();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8B9EFF",
    });
  }
}

/** Request notification permission; returns true when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!(await loadModule())) return false;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === "granted";
}

/** Daily-at-time trigger: DAILY on Android, repeating CALENDAR on iOS. */
function dailyTrigger(
  hour: number,
  minute: number,
): any {
  if (Platform.OS === "android") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour,
    minute,
    repeats: true,
  };
}

async function scheduleDaily(
  kind: "workout" | "meals" | "streak",
  config: ReminderConfig,
): Promise<void> {
  if (!config.enabled || !Notifications) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID(kind),
    content: CONTENT[kind],
    trigger: dailyTrigger(config.time.hour, config.time.minute),
  });
}

async function scheduleWater(
  config: WaterReminderConfig,
): Promise<void> {
  if (!config.enabled || !Notifications) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID("water"),
    content: CONTENT.water,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: config.intervalHours * 60 * 60,
      repeats: true,
      channelId: CHANNEL_ID,
    },
  });
}

/** Cancel a single reminder (safe if it was never scheduled). */
export async function cancelReminder(kind: ReminderKind): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(
      NOTIFICATION_ID(kind),
    );
  } catch {
    // No scheduled notification with that id — nothing to cancel.
  }
}

/**
 * Apply the full set of reminder prefs: cancels every reminder then
 * re-schedules the enabled ones. Idempotent, safe to call at startup.
 */
export async function applyReminders(
  prefs: ReminderPrefs,
): Promise<void> {
  if (!(await loadModule())) return;

  for (const kind of REMINDER_KINDS) {
    await cancelReminder(kind);
  }

  await Promise.all([
    scheduleDaily("workout", prefs.workout),
    scheduleDaily("meals", prefs.meals),
    scheduleDaily("streak", prefs.streak),
    scheduleWater(prefs.water),
  ]);
}

/** Cancel every scheduled reminder (e.g. all prefs turned off). */
export async function cancelAllReminders(): Promise<void> {
  if (!(await loadModule())) return;

  for (const kind of REMINDER_KINDS) {
    await cancelReminder(kind);
  }
}
