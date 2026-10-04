import { isWorkSet } from "@/services/forge/load";
import { getAllDailyActivities } from "@/storage/daily";
import { getMealDateKeys } from "@/storage/repositories/meals";
import { getCardioMap } from "@/storage/repositories/nourish-cardio";
import type { CardioMap } from "@/types/nourish";
import type { DailyActivity, WorkoutSession } from "@/types/gymos";
import { addDaysToKey, toDateKey } from "@/utils/date";

export type Streak = {
  days: number;
  todayActive: boolean;
};

/** How far back a streak is counted. */
const MAX_DAYS = 365;

/**
 * A Forge workout counts toward the streak only when it is *completed* by
 * Forge's own rules: it was finished (`endedAt`, the same test History and
 * Today use via `finishedSessions`) and it holds something real — at least
 * one completed non-warm-up set (`isWorkSet`, the same rule volume, PRs and
 * the grid use) or at least one cardio entry. A session that was merely
 * started, reopened, or finished with nothing logged does not count.
 */
function isCompletedWorkout(workout: WorkoutSession | undefined): boolean {
  if (!workout || typeof workout !== "object") return false;
  if (!workout.endedAt) return false;

  const hasWorkSet =
    Array.isArray(workout.exercises) &&
    workout.exercises.some(
      (exercise) =>
        Array.isArray(exercise?.sets) &&
        exercise.sets.some((set) => Boolean(set) && isWorkSet(set)),
    );

  if (hasWorkSet) return true;

  return (
    Array.isArray(workout.cardio) &&
    workout.cardio.some(
      (entry) =>
        Boolean(entry) &&
        Number.isFinite(entry.durationMin) &&
        entry.durationMin > 0,
    )
  );
}

/**
 * `hasMeals` comes from the dedicated meals store, not `activity.meals`
 * — meals no longer live embedded in the daily blob (see meals.ts), so
 * a day can be active purely from a logged meal even when it has no
 * DailyActivity record at all (`activity` undefined).
 *
 * `hasCardio` comes from the Forge cardio log (nourish-cardio.ts), which
 * is likewise its own store keyed by day: a logged cardio entry is a
 * completed one, so a cardio-only day counts without any session.
 */
function isActive(
  activity: DailyActivity | undefined,
  hasMeals: boolean,
  hasCardio: boolean,
): boolean {
  if (hasMeals || hasCardio) return true;
  if (!activity) return false;

  // A malformed record (corrupt write, partial migration) may miss an
  // array field: guard each one so the day reads as inactive instead
  // of throwing on `.length` and failing the whole streak read.
  return (
    (Array.isArray(activity.water) &&
      activity.water.length > 0) ||
    (Array.isArray(activity.workouts) &&
      activity.workouts.some(isCompletedWorkout)) ||
    (Array.isArray(activity.sleep) &&
      activity.sleep.length > 0) ||
    (Array.isArray(activity.measurements) &&
      activity.measurements.length > 0) ||
    (Array.isArray(activity.journal) &&
      activity.journal.length > 0)
  );
}

function hasCardioOn(cardio: CardioMap, dateKey: string): boolean {
  const list = cardio[dateKey];

  return Array.isArray(list) && list.length > 0;
}

/**
 * The streak as of `now`, from data already read. Pure: `now` is read once
 * by the caller, so every day key below comes from the same instant and a
 * midnight rollover mid-computation can't mix two different "todays".
 * Day keys are stepped with noon-anchored calendar arithmetic, so DST
 * shifts can't skip or repeat a day.
 */
export function computeStreak(
  all: Record<string, DailyActivity>,
  mealDateKeys: ReadonlySet<string>,
  cardio: CardioMap,
  now: Date,
): Streak {
  const todayKey = toDateKey(now);

  const activeOn = (dateKey: string): boolean =>
    isActive(
      all[dateKey],
      mealDateKeys.has(dateKey),
      hasCardioOn(cardio, dateKey),
    );

  const countBackFrom = (startOffset: number): number => {
    let streak = 0;

    for (let offset = startOffset; offset < MAX_DAYS; offset++) {
      if (!activeOn(addDaysToKey(todayKey, -offset))) break;

      streak++;
    }

    return streak;
  };

  if (activeOn(todayKey)) {
    return { days: countBackFrom(0), todayActive: true };
  }

  // Today isn't logged yet — the streak is preserved through
  // yesterday until the day ends, so count back from there.
  return { days: countBackFrom(1), todayActive: false };
}

/**
 * Always derived from storage at call time (nothing is cached), so a
 * finish, reopen or delete shows up on the next read. `now` is only
 * injectable for tests.
 */
export async function getStreak(now?: Date): Promise<Streak> {
  const [all, mealDateKeys, cardio] = await Promise.all([
    getAllDailyActivities(),
    getMealDateKeys(),
    getCardioMap(),
  ]);

  // Read the clock after the data arrives, once: the day the data was
  // read in is the day the streak is judged against.
  return computeStreak(all, mealDateKeys, cardio, now ?? new Date());
}
