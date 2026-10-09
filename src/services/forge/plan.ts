import { findExercise } from "@/services/forge/catalog";
import { finishedSessions } from "@/services/forge/history";
import type {
  CatalogExercise,
  Plan,
  PlanDay,
  PlanExercise,
} from "@/types/forge";
import type { Routine, WorkoutSession } from "@/types/gymos";
import { dateFromKey } from "@/utils/date";
import { createId } from "@/utils/id";

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = "8-10";

export const PLAN_TEMPLATES: Readonly<
  Record<string, readonly { name: string; exercises: readonly string[] }[]>
> = {
  "Upper / Lower": [
    {
      name: "Upper",
      exercises: [
        "Bench Press",
        "Barbell Row",
        "Overhead Press",
        "Lat Pulldown",
        "Biceps Curl",
        "Triceps Pushdown",
      ],
    },
    { name: "Lower", exercises: ["Squat", "Romanian Deadlift", "Leg Press"] },
  ],
  "Push Pull Legs": [
    {
      name: "Push",
      exercises: [
        "Bench Press",
        "Overhead Press",
        "Incline DB Press",
        "Lateral Raise",
        "Triceps Pushdown",
      ],
    },
    { name: "Pull", exercises: ["Barbell Row", "Lat Pulldown", "Biceps Curl"] },
    { name: "Legs", exercises: ["Squat", "Romanian Deadlift", "Leg Press"] },
  ],
  "Full body": [
    {
      name: "Full body",
      exercises: ["Squat", "Bench Press", "Barbell Row", "Overhead Press"],
    },
  ],
};

export function planExerciseFor(
  exercise: Pick<CatalogExercise, "id" | "name">,
  overrides: Partial<PlanExercise> = {},
): PlanExercise {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    sets: DEFAULT_SETS,
    reps: DEFAULT_REPS,
    weight: 0,
    ...overrides,
  };
}

export function newPlan(
  name: string,
  now: Date = new Date(),
  newId: () => string = createId,
): Plan {
  return {
    id: newId(),
    name: name.trim() || "My plan",
    days: [],
    schedule: {},
    rotate: false,
    deload: false,
    updatedAt: now.toISOString(),
  };
}

export function newDay(name: string, newId: () => string = createId): PlanDay {
  return { id: newId(), name: name.trim() || "Day", exercises: [] };
}

const stamp = (plan: Plan, now: Date): Plan => ({
  ...plan,
  updatedAt: now.toISOString(),
});

/** Build a plan from a template; unknown names are skipped, not invented. */
export function planFromTemplate(
  template: string,
  catalog: readonly CatalogExercise[],
  now: Date = new Date(),
  newId: () => string = createId,
): Plan | null {
  const days = PLAN_TEMPLATES[template];

  if (!days) return null;

  const plan = newPlan(template, now, newId);

  plan.days = days.map((day) => ({
    id: newId(),
    name: day.name,
    exercises: day.exercises.flatMap((name) => {
      const found = findExercise(catalog, name);

      return found ? [planExerciseFor(found)] : [];
    }),
  }));
  plan.rotate = true;

  return plan;
}

export function addDay(
  plan: Plan,
  name: string,
  now: Date,
  newId?: () => string,
): Plan {
  return stamp({ ...plan, days: [...plan.days, newDay(name, newId)] }, now);
}

/** Removing a day also clears it from the weekly schedule. */
export function removeDay(plan: Plan, dayId: string, now: Date): Plan {
  const schedule = Object.fromEntries(
    Object.entries(plan.schedule).filter(([, id]) => id !== dayId),
  );

  return stamp(
    { ...plan, days: plan.days.filter((day) => day.id !== dayId), schedule },
    now,
  );
}

/** Restore a previously removed day at its original index and schedule. */
export function reinsertDay(
  plan: Plan,
  day: PlanDay,
  index: number,
  scheduleEntries: Record<string, string> = {},
  now: Date = new Date(),
): Plan {
  const days = [...plan.days];
  const targetIndex = Math.max(0, Math.min(index, days.length));
  days.splice(targetIndex, 0, day);
  const schedule = { ...plan.schedule, ...scheduleEntries };
  return stamp({ ...plan, days, schedule }, now);
}

export function renameDay(
  plan: Plan,
  dayId: string,
  name: string,
  now: Date,
): Plan {
  return stamp(
    {
      ...plan,
      days: plan.days.map((day) =>
        day.id === dayId ? { ...day, name: name.trim() || day.name } : day,
      ),
    },
    now,
  );
}

/** Assign (or, on the same day id, clear) a weekday (0 = Sunday). */
export function toggleScheduleDay(
  plan: Plan,
  weekday: number,
  dayId: string,
  now: Date,
): Plan {
  const key = String(weekday);
  const schedule = { ...plan.schedule };

  if (schedule[key] === dayId) delete schedule[key];
  else schedule[key] = dayId;

  return stamp({ ...plan, schedule }, now);
}

function mapDay(
  plan: Plan,
  dayId: string,
  change: (day: PlanDay) => PlanDay,
  now: Date,
): Plan {
  return stamp(
    {
      ...plan,
      days: plan.days.map((day) => (day.id === dayId ? change(day) : day)),
    },
    now,
  );
}

export const addPlanExercise = (
  plan: Plan,
  dayId: string,
  exercise: PlanExercise,
  now: Date,
): Plan =>
  mapDay(
    plan,
    dayId,
    (day) => ({ ...day, exercises: [...day.exercises, exercise] }),
    now,
  );

export const updatePlanExercise = (
  plan: Plan,
  dayId: string,
  index: number,
  patch: Partial<PlanExercise>,
  now: Date,
): Plan =>
  mapDay(
    plan,
    dayId,
    (day) => ({
      ...day,
      exercises: day.exercises.map((exercise, i) =>
        i === index ? { ...exercise, ...patch } : exercise,
      ),
    }),
    now,
  );

export const removePlanExercise = (
  plan: Plan,
  dayId: string,
  index: number,
  now: Date,
): Plan =>
  mapDay(
    plan,
    dayId,
    (day) => ({
      ...day,
      // A superset flag must not dangle onto the last exercise.
      exercises: day.exercises
        .filter((_, i) => i !== index)
        .map((exercise, i, rest) =>
          i === rest.length - 1 ? { ...exercise, superset: false } : exercise,
        ),
    }),
    now,
  );

/** Restore a previously removed exercise in a day at its original index. */
export const reinsertPlanExercise = (
  plan: Plan,
  dayId: string,
  index: number,
  exercise: PlanExercise,
  now: Date = new Date(),
): Plan =>
  mapDay(
    plan,
    dayId,
    (day) => {
      const exercises = [...day.exercises];
      const targetIndex = Math.max(0, Math.min(index, exercises.length));
      exercises.splice(targetIndex, 0, exercise);
      return { ...day, exercises };
    },
    now,
  );

export const movePlanExerciseUp = (
  plan: Plan,
  dayId: string,
  index: number,
  now: Date,
): Plan =>
  mapDay(
    plan,
    dayId,
    (day) => {
      if (index <= 0 || index >= day.exercises.length) return day;

      const exercises = [...day.exercises];
      const above = exercises[index - 1];
      const current = exercises[index];

      if (!above || !current) return day;

      exercises[index - 1] = current;
      exercises[index] = above;

      return { ...day, exercises };
    },
    now,
  );

/** Which plan day is scheduled on `dateKey`, if any. */
export function scheduledDay(plan: Plan, dateKey: string): PlanDay | null {
  const id = plan.schedule[String(dateFromKey(dateKey).getDay())];

  return plan.days.find((day) => day.id === id) ?? null;
}

/** Rotation: the day after the one most recently trained (or the first). */
export function nextRotationDay(
  plan: Plan,
  sessions: readonly WorkoutSession[],
): PlanDay | null {
  if (plan.days.length === 0) return null;

  const last = [...finishedSessions(sessions)]
    .reverse()
    .find((session) => session.planId === plan.id && session.dayId);
  const index = last ? plan.days.findIndex((day) => day.id === last.dayId) : -1;

  return plan.days[(index + 1) % plan.days.length] ?? null;
}

/**
 * The day to train on `dateKey`. Rotation only makes sense for today (it
 * depends on what was trained last); other dates use the weekly schedule.
 */
export function dayFor(
  plan: Plan | undefined,
  dateKey: string,
  todayKey: string,
  sessions: readonly WorkoutSession[],
): PlanDay | null {
  if (!plan) return null;

  if (plan.rotate) {
    return dateKey === todayKey ? nextRotationDay(plan, sessions) : null;
  }

  return scheduledDay(plan, dateKey);
}

/** Turn the old Workouts screen's routines into a plan, one day each. */
export function planFromRoutines(
  routines: readonly Routine[],
  catalog: readonly CatalogExercise[],
  now: Date = new Date(),
  newId: () => string = createId,
): Plan | null {
  const usable = routines.filter((routine) => routine.exercises.length > 0);

  if (usable.length === 0) return null;

  const plan = newPlan("My routines", now, newId);

  plan.rotate = true;
  plan.days = usable.map((routine) => ({
    id: newId(),
    name: routine.name,
    exercises: routine.exercises.map((entry) => {
      const found =
        findExercise(catalog, entry.exerciseId) ??
        findExercise(catalog, entry.name);

      return planExerciseFor(found ?? { id: entry.exerciseId, name: entry.name });
    }),
  }));

  return plan;
}
