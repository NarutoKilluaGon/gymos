import type { FeelValue } from "@/types/nourish";
import { addDaysToKey, dateFromKey } from "@/utils/date";
import { MONTH_SHORT } from "@/services/nourish/insights";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Today", "Yesterday", else "Mon, 4 Mar". */
export function dayTitle(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === addDaysToKey(todayKey, -1)) return "Yesterday";

  const date = dateFromKey(key);

  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

/** "Wednesday, 30 Sep" */
export function dayHeading(key: string): string {
  const date = dateFromKey(key);

  return `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export const FEEL_OPTIONS: readonly { value: FeelValue; label: string }[] = [
  { value: 1, label: "Still hungry" },
  { value: 2, label: "Just right" },
  { value: 3, label: "Too full" },
];
