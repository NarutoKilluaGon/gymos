import { appendEvent } from "@/storage/events";
import {
  readAllDailyActivitiesUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { Meal, MealFood, Micronutrients } from "@/types/gymos";
import { NUTRIENT_KEYS } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

const MEALS_KEY = "@gymos/meals";

/**
 * One-time migration flag. Meals used to live embedded inside each day's
 * DailyActivity in the shared `@gymos/daily` blob — meaning logging a
 * single meal read and rewrote the user's ENTIRE app history (water,
 * workouts, sleep, measurements, journal, every day) on every single
 * save. Meals now get their own dedicated key, the same pattern
 * saved-foods/nutrition-targets/nutrition-profile already use.
 *
 * An explicit flag (rather than "is @gymos/meals empty?") is required:
 * a user who has genuinely never logged a meal must not be re-scanned
 * on every single read. import.ts clears this flag when restoring a
 * backup that predates this migration, so an old backup's embedded
 * meals still get picked up on the next call rather than silently
 * going missing.
 */
const MEALS_MIGRATED_KEY = "@gymos/meals-migrated-v1";

const mealsMutex = createMutex();

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} & Micronutrients;

const EMPTY_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/**
 * Local date key ("YYYY-MM-DD") a meal belongs to, derived from its own
 * timestamp — mirrors getTodayKey's exact format so a meal logged today
 * always groups under the same key getTodayKey() returns. Meals used to
 * be grouped by WHERE they were stored (which day's blob); now that
 * they all live in one flat list, grouping has to be derived instead.
 * A malformed/missing timestamp (never produced by addMeal, but
 * possible in an imported or hand-edited record) sorts under a sentinel
 * that can't collide with a real date, rather than throwing or being
 * silently dropped from getAllMeals.
 */
function dateKeyOfMeal(meal: Meal): string {
  const parsed = new Date(meal.timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return "invalid-date";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function readMealsUnlocked(): Promise<Meal[]> {
  const stored = await getStorage<Meal[]>(MEALS_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function writeMealsUnlocked(meals: Meal[]): Promise<void> {
  await setStorage(MEALS_KEY, meals);
}

/**
 * Pull every already-logged meal out of the legacy daily blob into the
 * dedicated store, then strip the now-duplicate `meals` arrays out of
 * each day's DailyActivity so every OTHER module's daily reads/writes
 * (water, workouts, sleep, measurements, journal) get lighter too —
 * they were never the ones reading `.meals`, they just carried it along.
 *
 * Merges by meal `id` rather than appending blindly, which makes this
 * safe to run more than once for the same underlying data — including
 * after import.ts resets the migrated flag for an old backup restore,
 * where some of the restored meals may already exist in the store from
 * this device's own history since the backup was taken.
 *
 * Runs under the daily lock (required by readAllDailyActivitiesUnlocked/
 * writeDailyActivityUnlocked) nested inside the meals lock — always in
 * that order, never the reverse, so the two independent mutexes can
 * never deadlock against each other.
 */
async function ensureMigratedUnlocked(): Promise<void> {
  const migrated = await getStorage<boolean>(MEALS_MIGRATED_KEY);

  if (migrated) {
    return;
  }

  await withDailyLock(async () => {
    const activities = await readAllDailyActivitiesUnlocked();
    const migratedMeals: Meal[] = [];

    for (const activity of Object.values(activities)) {
      if (Array.isArray(activity.meals) && activity.meals.length > 0) {
        migratedMeals.push(...activity.meals);
        activity.meals = [];
        await writeDailyActivityUnlocked(activity);
      }
    }

    if (migratedMeals.length > 0) {
      const existing = await readMealsUnlocked();
      const byId = new Map(existing.map((meal) => [meal.id, meal]));

      for (const meal of migratedMeals) {
        if (!byId.has(meal.id)) {
          byId.set(meal.id, meal);
        }
      }

      await writeMealsUnlocked([...byId.values()]);
    }
  });

  await setStorage(MEALS_MIGRATED_KEY, true);
}

export async function addMeal(
  name: string,
  macros?: Partial<MacroTotals>,
  foods?: MealFood[],
): Promise<Meal> {
  const saved = await mealsMutex.runExclusive(async () => {
    await ensureMigratedUnlocked();

    const meals = await readMealsUnlocked();

    const meal: Meal = {
      id: createId(),
      name,
      timestamp: new Date().toISOString(),
      ...macros,
      // Optional per-food breakdown (incl. additionals) rides in the same
      // record under the same lock — one storage key, one source of
      // truth, no second write to keep in sync.
      ...(foods && foods.length > 0 ? { foods } : {}),
    };

    meals.push(meal);

    await writeMealsUnlocked(meals);

    return meal;
  });

  await appendEvent("meal.logged", {
    mealId: saved.id,
    name,
    calories: saved.calories,
    protein: saved.protein,
    carbs: saved.carbs,
    fat: saved.fat,
  });

  return saved;
}

/**
 * Update today's meal in place (edit flow). Same record, same lock, same
 * event-log semantics as addMeal — no new storage, no duplicate entry.
 * Totals stay authoritative; an empty foods list clears a previously
 * saved breakdown. Returns null when the meal is not found among
 * TODAY's meals (e.g. it was logged on another day, which this diary
 * never edits — unchanged from before the storage split).
 */
export async function updateMeal(
  id: string,
  name: string,
  macros?: Partial<MacroTotals>,
  foods?: MealFood[],
): Promise<Meal | null> {
  return mealsMutex.runExclusive(async () => {
    await ensureMigratedUnlocked();

    const meals = await readMealsUnlocked();
    const todayKey = getTodayKey();
    const index = meals.findIndex(
      (meal) => meal.id === id && dateKeyOfMeal(meal) === todayKey,
    );

    if (index === -1) {
      return null;
    }

    const updated: Meal = {
      ...meals[index],
      name,
      ...macros,
      ...(foods && foods.length > 0 ? { foods } : { foods: undefined }),
    };

    meals[index] = updated;

    await writeMealsUnlocked(meals);

    return updated;
  });
}

export async function getMealsForDate(
  dateKey: string,
): Promise<Meal[]> {
  return mealsMutex.runExclusive(async () => {
    await ensureMigratedUnlocked();

    const meals = await readMealsUnlocked();

    return meals.filter((meal) => dateKeyOfMeal(meal) === dateKey);
  });
}

export async function getTodayMeals(): Promise<Meal[]> {
  return getMealsForDate(getTodayKey());
}

export async function deleteMeal(
  mealId: string,
): Promise<void> {
  const deleted = await mealsMutex.runExclusive(async () => {
    await ensureMigratedUnlocked();

    const meals = await readMealsUnlocked();
    const todayKey = getTodayKey();
    const countBefore = meals.length;

    // Matches only among TODAY's meals — same restriction as before the
    // storage split (this diary never edits another day's log).
    const filtered = meals.filter(
      (meal) =>
        !(meal.id === mealId && dateKeyOfMeal(meal) === todayKey),
    );

    if (filtered.length === countBefore) {
      return false;
    }

    await writeMealsUnlocked(filtered);

    return true;
  });

  if (deleted) {
    await appendEvent("meal.deleted", { mealId });
  }
}

export async function getDailyMacroTotals(
  dateKey: string,
): Promise<MacroTotals> {
  const meals = await getMealsForDate(dateKey);

  if (meals.length === 0) {
    return EMPTY_MACROS;
  }

  return meals.reduce<MacroTotals>(
    (totals, meal) => {
      const next = { ...totals };

      for (const key of NUTRIENT_KEYS) {
        next[key] = (next[key] ?? 0) + (meal[key] ?? 0);
      }

      return next;
    },
    EMPTY_MACROS,
  );
}

export async function getAllMeals(): Promise<Meal[]> {
  return mealsMutex.runExclusive(async () => {
    await ensureMigratedUnlocked();

    const meals = await readMealsUnlocked();

    return [...meals].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );
  });
}

/**
 * Every local date key with at least one logged meal. Purpose-built for
 * streak.ts, which previously read `activity.meals.length > 0` straight
 * off the shared daily blob — now that meals live elsewhere, streak
 * needs an existence check per date rather than the full meal list.
 */
export async function getMealDateKeys(): Promise<Set<string>> {
  const meals = await getAllMeals();

  return new Set(meals.map(dateKeyOfMeal));
}
