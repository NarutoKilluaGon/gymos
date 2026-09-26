import {
  AppState,
  type AppStateStatus,
} from "react-native";

type Listener = () => void;

type EventSource = {
  addEventListener?: (
    type: string,
    listener: () => void,
  ) => void;
  removeEventListener?: (
    type: string,
    listener: () => void,
  ) => void;
};

/**
 * Minimal dependency-free retry triggers. App resume covers native
 * platforms; the optional global online event covers web/runtime hosts that
 * expose connectivity events. Nutrition focus is wired separately by the
 * screen, so no polling timer or connectivity package is needed.
 */
export function subscribeToDescriptionAiRetryTriggers(
  listener: Listener,
): () => void {
  const handleAppState = (state: AppStateStatus) => {
    if (state === "active") {
      listener();
    }
  };

  const appStateSubscription = AppState.addEventListener(
    "change",
    handleAppState,
  );
  const eventSource = globalThis as unknown as EventSource;
  const handleOnline = () => listener();

  eventSource.addEventListener?.("online", handleOnline);

  return () => {
    appStateSubscription.remove();
    eventSource.removeEventListener?.("online", handleOnline);
  };
}
