import { Pedometer } from "expo-sensors";
import { AppState, type AppStateStatus } from "react-native";

import { addSteps } from "@/storage/repositories/steps";

let stepSubscription: { remove: () => void } | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isTracking = false;

let lastSeenSteps: number | null = null;
let pendingSteps = 0;

const FLUSH_INTERVAL_MS = 30_000;

function flush(): void {
  if (pendingSteps === 0) return;

  const delta = pendingSteps;
  pendingSteps = 0;

  // Background write — a storage failure here must not surface a toast
  // every 30s. Log it; the deltas are intentionally dropped on error.
  addSteps(delta).catch((error) => {
    console.error("[Steps] Failed to persist step count", error);
  });
}

export type StepPermissionStatus =
  | "granted"
  | "not_granted"
  | "blocked"
  | "unavailable";

/**
 * Check the current pedometer permission status silently without prompting.
 */
export async function getStepPermissionStatus(): Promise<StepPermissionStatus> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      return "unavailable";
    }

    const permission = await Pedometer.getPermissionsAsync();
    if (permission.granted) {
      return "granted";
    }

    if (permission.canAskAgain === false) {
      return "blocked";
    }

    return "not_granted";
  } catch (error) {
    console.warn("[Steps] Failed to get pedometer permission status", error);
    return "unavailable";
  }
}

/**
 * Prompt the user for pedometer permission (ACTIVITY_RECOGNITION on Android).
 * If granted, starts tracking immediately.
 */
export async function requestStepPermission(): Promise<StepPermissionStatus> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      return "unavailable";
    }

    const permission = await Pedometer.requestPermissionsAsync();
    if (permission.granted) {
      await startStepTracking();
      return "granted";
    }

    if (permission.canAskAgain === false) {
      return "blocked";
    }

    return "not_granted";
  } catch (error) {
    console.warn("[Steps] Failed to request pedometer permission", error);
    return "not_granted";
  }
}

export function isStepTrackingActive(): boolean {
  return isTracking;
}

/**
 * Start listening to the system pedometer and persisting
 * the daily step count to storage.
 *
 * Safe to call multiple times — no-op if already tracking.
 * Checks permissions silently on launch — does NOT prompt.
 * If permission is granted, starts watchStepCount.
 */
export async function startStepTracking(): Promise<boolean> {
  if (isTracking) return true;

  try {
    const available = await Pedometer.isAvailableAsync();

    if (!available) {
      return false;
    }

    // Silent check — do not prompt on app launch
    const permission = await Pedometer.getPermissionsAsync();

    if (!permission.granted) {
      return false;
    }
  } catch (error) {
    console.warn("[Steps] Failed to initialise pedometer", error);
    return false;
  }

  isTracking = true;

  // The pedometer reports a count cumulative since the listener
  // started (STEP_COUNTER baseline), so track the baseline and
  // persist only the deltas, coalescing them before each flush.
  stepSubscription = Pedometer.watchStepCount(({ steps }) => {
    if (lastSeenSteps === null) {
      lastSeenSteps = steps;
      return;
    }

    const delta = steps - lastSeenSteps;

    if (delta > 0) {
      lastSeenSteps = steps;
      pendingSteps += delta;
    }
  });

  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  appStateSubscription = AppState.addEventListener(
    "change",
    (state: AppStateStatus) => {
      if (state !== "active") flush();
    },
  );

  return true;
}

export function stopStepTracking(): void {
  if (!isTracking) return;

  isTracking = false;
  lastSeenSteps = null;

  stepSubscription?.remove();
  stepSubscription = null;

  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  appStateSubscription?.remove();
  appStateSubscription = null;

  flush();
}
