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

/**
 * Start listening to the system pedometer and persisting
 * the daily step count to storage.
 *
 * Safe to call multiple times — no-op if already tracking.
 * On unsupported devices or denied permission, logs and returns early.
 */
export async function startStepTracking(): Promise<void> {
  if (isTracking) return;

  try {
    const available = await Pedometer.isAvailableAsync();

    if (!available) {
      console.log("[Steps] Pedometer not available on this device");
      return;
    }

    const permission = await Pedometer.requestPermissionsAsync();

    if (!permission.granted) {
      console.log("[Steps] Pedometer permission not granted");
      return;
    }
  } catch (error) {
    console.warn("[Steps] Failed to initialise pedometer", error);
    return;
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
}

export function stopStepTracking(): void {
  if (!isTracking) return;

  isTracking = false;

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
