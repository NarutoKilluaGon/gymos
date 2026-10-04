/** Local "YYYY-MM-DD" for a Date. The one place the key format lives. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayKey(): string {
  return toDateKey(new Date());
}

/** Local date key of an ISO timestamp, or null when it is malformed. */
export function dateKeyFromTimestamp(timestamp: string): string | null {
  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

/** A Date at local noon for a "YYYY-MM-DD" key. Noon keeps day arithmetic
 *  safe across daylight-saving shifts. */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

/** Shift a date key by whole days (negative goes back). */
export function addDaysToKey(key: string, days: number): string {
  const date = dateFromKey(key);

  date.setDate(date.getDate() + days);

  return toDateKey(date);
}

/** Whole days from `fromKey` to `toKey` (positive when `toKey` is later). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round(
    (dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) /
      86_400_000,
  );
}

/** ISO timestamp for a day key at a local "HH:MM". */
export function timestampForKey(key: string, hm: string): string {
  const [hours, minutes] = hm.split(":").map(Number);
  const date = dateFromKey(key);

  date.setHours(hours ?? 12, minutes ?? 0, 0, 0);

  return date.toISOString();
}
