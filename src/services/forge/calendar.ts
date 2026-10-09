import { completedSessions, sessionDate } from "@/services/forge/history";
import type { CardioLog } from "@/types/nourish";
import type { WorkoutSession } from "@/types/gymos";
import { toDateKey, getTodayKey } from "@/utils/date";

export type CalendarDaySummary = {
  sessions: WorkoutSession[];
  cardio: CardioLog[];
  hasStrength: boolean;
  hasCardio: boolean;
};

/**
 * Builds an indexed Map<dayKey, summary> once across all sessions and cardio logs.
 * Avoids scanning all sessions per calendar cell.
 */
export function buildCalendarSummaryMap(
  sessions: readonly WorkoutSession[],
  cardioMap: Record<string, readonly CardioLog[] | undefined>,
): Map<string, CalendarDaySummary> {
  const map = new Map<string, CalendarDaySummary>();

  for (const session of completedSessions(sessions)) {
    const key = sessionDate(session);
    if (!key) continue;

    let entry = map.get(key);
    if (!entry) {
      entry = { sessions: [], cardio: [], hasStrength: false, hasCardio: false };
      map.set(key, entry);
    }
    entry.sessions.push(session);
    entry.hasStrength = true;
  }

  for (const [key, logs] of Object.entries(cardioMap)) {
    if (!logs || logs.length === 0) continue;

    let entry = map.get(key);
    if (!entry) {
      entry = { sessions: [], cardio: [], hasStrength: false, hasCardio: false };
      map.set(key, entry);
    }
    entry.cardio.push(...logs);
    entry.hasCardio = true;
  }

  return map;
}

export type MonthCell = {
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasStrength: boolean;
  hasCardio: boolean;
};

/**
 * Generates cells for a Monday-first monthly calendar grid.
 * Month is 0-indexed (0 = Jan, 11 = Dec).
 */
export function getMonthGrid(
  year: number,
  month: number,
  summaryMap: Map<string, CalendarDaySummary>,
  todayKey: string = getTodayKey(),
): MonthCell[] {
  const cells: MonthCell[] = [];

  // First day of target month
  const firstDay = new Date(year, month, 1);
  // Day of week: 0 = Sun, 1 = Mon ... 6 = Sat.
  // Monday-first offset: Mon -> 0, Tue -> 1 ... Sun -> 6.
  const startDay = (firstDay.getDay() + 6) % 7;

  // Number of days in target month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days in previous month for padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const dayNumber = prevMonthDays - i;
    const date = new Date(year, month - 1, dayNumber);
    const key = toDateKey(date);
    const summary = summaryMap.get(key);

    cells.push({
      key,
      dayNumber,
      isCurrentMonth: false,
      isToday: key === todayKey,
      hasStrength: !!summary?.hasStrength,
      hasCardio: !!summary?.hasCardio,
    });
  }

  // Days in current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const summary = summaryMap.get(key);

    cells.push({
      key,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: key === todayKey,
      hasStrength: !!summary?.hasStrength,
      hasCardio: !!summary?.hasCardio,
    });
  }

  // Next month padding to fill complete rows of 7
  const remainder = cells.length % 7;
  if (remainder > 0) {
    const daysToAdd = 7 - remainder;
    for (let day = 1; day <= daysToAdd; day++) {
      const date = new Date(year, month + 1, day);
      const key = toDateKey(date);
      const summary = summaryMap.get(key);

      cells.push({
        key,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: key === todayKey,
        hasStrength: !!summary?.hasStrength,
        hasCardio: !!summary?.hasCardio,
      });
    }
  }

  return cells;
}

/**
 * Monthly stats: workouts, cardio sessions, active streak.
 */
export function getMonthStats(
  year: number,
  month: number,
  summaryMap: Map<string, CalendarDaySummary>,
): {
  workoutsThisMonth: number;
  cardioThisMonth: number;
  activeStreakDays: number;
} {
  let workouts = 0;
  let cardio = 0;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toDateKey(new Date(year, month, d));
    const summary = summaryMap.get(key);
    if (summary?.hasStrength) workouts++;
    if (summary?.hasCardio) cardio++;
  }

  // Compute current streak ending at today (or yesterday)
  const today = new Date();
  let streak = 0;
  let check = new Date(today);

  // Check today
  let checkKey = toDateKey(check);
  let hasActivityToday = summaryMap.get(checkKey)?.hasStrength || summaryMap.get(checkKey)?.hasCardio;

  if (!hasActivityToday) {
    // If nothing today yet, check from yesterday
    check.setDate(check.getDate() - 1);
    checkKey = toDateKey(check);
  }

  while (true) {
    const s = summaryMap.get(checkKey);
    if (s?.hasStrength || s?.hasCardio) {
      streak++;
      check.setDate(check.getDate() - 1);
      checkKey = toDateKey(check);
    } else {
      break;
    }
  }

  return {
    workoutsThisMonth: workouts,
    cardioThisMonth: cardio,
    activeStreakDays: streak,
  };
}
