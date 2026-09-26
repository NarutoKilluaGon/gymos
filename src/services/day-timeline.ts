import type { Meal } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";
import { getTodayKey } from "@/utils/date";

/**
 * One row of the Nutrition day view (S6). Meals render from the daily
 * store as full editable S6A cards; `activity` rows render from the
 * existing event/timeline infrastructure (`getTimeline()`); `steps` is
 * its own day-level row — never a meal, workout, or cardio entry, and
 * never an input to calorie math (that belongs to S7).
 */
export type DayTimelineEntry =
  | { type: "meal"; meal: Meal }
  | { type: "activity"; item: TimelineItem }
  | { type: "steps"; count: number };

/** Local calendar date (mirrors getTodayKey and the Journal timeline's
 *  grouping) so "today" agrees with the user's day, not UTC. Null when
 *  the timestamp is unparseable. Reused by the S7 calorie-target engine
 *  so both features group "today" identically. */
export function toDayKey(timestamp: string): string | null {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Sort position for a persisted timestamp. Unparseable timestamps sort
 *  last so one malformed record can't scramble the day's order. */
function timeOf(timestamp: string): number {
  const time = new Date(timestamp).getTime();

  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Merge today's meals, event-timeline items, and step count into one
 * chronological day view. Pure and defensive: persisted stores predate
 * validation, so non-array inputs, null entries, and malformed records
 * are skipped or degraded — never thrown.
 *
 * - Meals come from the daily store (full records, S6A editing intact)
 *   and always display, even with a bad timestamp (time shows blank,
 *   sorted last).
 * - Activity items are expected from `getTimeline()` (already
 *   tombstone-aware): kept only for today, except kind "meal" — the
 *   event log's meal summaries would duplicate the full meal cards
 *   with less data. Unknown kinds are kept; the UI renders them as a
 *   generic row instead of crashing.
 * - Steps (separate `@gymos/steps` store, no persisted timestamp) close
 *   the timeline as their own row. Zero/missing/invalid counts omit it.
 */
export function buildDayTimeline(input: {
  meals?: Meal[] | null;
  timelineItems?: TimelineItem[] | null;
  steps?: number | null;
  todayKey?: string;
}): DayTimelineEntry[] {
  const todayKey = input.todayKey ?? getTodayKey();

  const sortable: Array<{
    entry: DayTimelineEntry;
    time: number;
    order: number;
  }> = [];
  let order = 0;

  const meals = Array.isArray(input.meals) ? input.meals : [];

  for (const meal of meals) {
    if (!isRecord(meal)) {
      continue;
    }

    const timestamp = (meal as { timestamp?: unknown }).timestamp;

    sortable.push({
      entry: { type: "meal", meal: meal as Meal },
      time:
        typeof timestamp === "string"
          ? timeOf(timestamp)
          : Number.POSITIVE_INFINITY,
      order: order++,
    });
  }

  const items = Array.isArray(input.timelineItems)
    ? input.timelineItems
    : [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const record = item as {
      kind?: unknown;
      id?: unknown;
      timestamp?: unknown;
    };

    if (
      typeof record.kind !== "string" ||
      typeof record.id !== "string" ||
      typeof record.timestamp !== "string"
    ) {
      continue;
    }

    if (record.kind === "meal") {
      continue;
    }

    const dayKey = toDayKey(record.timestamp);

    if (dayKey === null || dayKey !== todayKey) {
      continue;
    }

    sortable.push({
      entry: { type: "activity", item: item as TimelineItem },
      time: timeOf(record.timestamp),
      order: order++,
    });
  }

  sortable.sort((a, b) => a.time - b.time || a.order - b.order);

  const entries = sortable.map((row) => row.entry);

  const steps = input.steps;

  if (
    typeof steps === "number" &&
    Number.isFinite(steps) &&
    steps > 0
  ) {
    entries.push({ type: "steps", count: Math.floor(steps) });
  }

  return entries;
}
