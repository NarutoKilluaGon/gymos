import { getAllDailyActivities } from "@/storage/daily";
import { getMealDateKeys } from "@/storage/repositories/meals";
import type { DailyActivity } from "@/types/gymos";

export type Streak = {
  days: number;
  todayActive: boolean;
};

/**
 * `hasMeals` comes from the dedicated meals store, not `activity.meals`
 * — meals no longer live embedded in the daily blob (see meals.ts), so
 * a day can be active purely from a logged meal even when it has no
 * DailyActivity record at all (`activity` undefined).
 */
function isActive(
  activity: DailyActivity | undefined,
  hasMeals: boolean,
): boolean {
  if (hasMeals) return true;
  if (!activity) return false;

  // A malformed record (corrupt write, partial migration) may miss an
  // array field: guard each one so the day reads as inactive instead
  // of throwing on `.length` and failing the whole streak read.
  return (
    (Array.isArray(activity.water) &&
      activity.water.length > 0) ||
    (Array.isArray(activity.workouts) &&
      activity.workouts.length > 0) ||
    (Array.isArray(activity.sleep) &&
      activity.sleep.length > 0) ||
    (Array.isArray(activity.measurements) &&
      activity.measurements.length > 0) ||
    (Array.isArray(activity.journal) &&
      activity.journal.length > 0)
  );
}

function dateKeyAtOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function countBackFrom(
  all: Record<string, DailyActivity>,
  mealDateKeys: Set<string>,
  startOffset: number,
): number {
  let streak = 0;

  for (let offset = startOffset; offset < 365; offset++) {
    const dateKey = dateKeyAtOffset(offset);
    const activity = all[dateKey];

    if (isActive(activity, mealDateKeys.has(dateKey))) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function getStreak(): Promise<Streak> {
  const [all, mealDateKeys] = await Promise.all([
    getAllDailyActivities(),
    getMealDateKeys(),
  ]);

  const todayKey = dateKeyAtOffset(0);
  const todayActive = isActive(
    all[todayKey],
    mealDateKeys.has(todayKey),
  );

  if (todayActive) {
    return {
      days: countBackFrom(all, mealDateKeys, 0),
      todayActive: true,
    };
  }

  // Today isn't logged yet — the streak is preserved through
  // yesterday until the day ends, so count back from there.
  return {
    days: countBackFrom(all, mealDateKeys, 1),
    todayActive: false,
  };
}