import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { getTodayKey } from "@/utils/date";

/** Never schedule tighter than this, so a clock that reads "just before
 *  midnight" cannot spin the timer. */
const MIN_DELAY_MS = 1_000;
/** Land just after midnight, not on the boundary, so a timer that fires a
 *  few ms early still sees the new local day. */
const MIDNIGHT_SLACK_MS = 250;

/** Milliseconds from `now` to the next local midnight. Built from calendar
 *  fields (not now + 24h), so 23h/25h daylight-saving days stay correct. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

  return Math.max(next.getTime() - now.getTime(), 0);
}

/**
 * The current local date key, kept live while the component stays mounted:
 * it refreshes when the app returns to the foreground and at the next local
 * midnight (then re-arms for the following one). `getTodayKey()` alone is
 * only read at render time, so an app left open overnight keeps yesterday.
 */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(getTodayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => setTodayKey(getTodayKey());

    const arm = () => {
      if (timer !== undefined) clearTimeout(timer);

      timer = setTimeout(
        () => {
          refresh();
          arm();
        },
        Math.max(msUntilNextMidnight() + MIDNIGHT_SLACK_MS, MIN_DELAY_MS),
      );
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Timers can be suspended while backgrounded: re-check, then re-arm.
        refresh();
        arm();
      }
    });

    // Also covers a rollover between the first render and this effect.
    refresh();
    arm();

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return todayKey;
}
