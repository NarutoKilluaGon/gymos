import { convert, type WeightUnit } from "@/services/forge/load";
import type { CatalogExercise, PlanDay, PlanExercise } from "@/types/forge";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { timestampForKey } from "@/utils/date";
import { createId } from "@/utils/id";

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

/** Smallest sensible plate jump, by unit. */
const STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

const DELOAD_SET_FACTOR = 0.6;
const DELOAD_LOAD_FACTOR = 0.9;
const DEFAULT_SETS = 3;
const DEFAULT_REPS = 8;

/** Highest number in a rep target: "8-10" → 10, "5" → 5. */
export function topReps(target: string | undefined): number {
  const parsed = parseInt(String(target ?? "").split("-").pop() ?? "", 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

/** Lowest number in a rep target: "8-10" → 8. */
export function bottomReps(target: string | undefined): number {
  const parsed = parseInt(String(target ?? ""), 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * One exercise for a new session, prefilled from the last time it was done
 * (so the plate math is already in the inputs) and from the plan target.
 *
 * Progressive overload: if EVERY set last time reached the top of the rep
 * range (and had a load, unless bodyweight), the planned load goes up one
 * step and reps drop back to the bottom of the range. A deload week cuts
 * sets to 60% (minimum 2) and loads to 90%, and never progresses.
 */
export function buildExercise(input: {
  exercise: Pick<CatalogExercise, "id" | "name" | "bodyweight">;
  target?: Pick<PlanExercise, "sets" | "reps" | "weight" | "tip">;
  /** Work sets from the previous session, or null if none. */
  previous: readonly WorkoutSet[] | null;
  deload: boolean;
  unit: WeightUnit;
  /** Coaching cue to show when the target carries none. */
  fallbackTip?: string;
  newId?: () => string;
}): WorkoutExercise {
  const newId = input.newId ?? createId;
  const { exercise, target, previous, deload, unit } = input;
  const prev = previous && previous.length > 0 ? previous : null;
  const planned = target ? Number(target.sets) || DEFAULT_SETS : 0;
  const baseSets = target ? planned : prev ? prev.length : DEFAULT_SETS;
  const count = deload
    ? Math.max(2, Math.round(baseSets * DELOAD_SET_FACTOR))
    : baseSets;
  const hi = target ? topReps(target.reps) : 0;
  const bodyweight = exercise.bodyweight;
  const progressed =
    !deload &&
    prev !== null &&
    hi > 0 &&
    prev.every((set) => (bodyweight || (set.weight ?? 0)) && set.reps >= hi);
  const step = STEP[unit];
  const targetWeight = target ? convert(target.weight, "kg", unit) : 0;

  const sets: WorkoutSet[] = Array.from({ length: count }, (_, index) => {
    const last = prev ? (prev[index] ?? prev[prev.length - 1]) : undefined;
    let weight = targetWeight;
    let reps = bottomReps(target?.reps) || DEFAULT_REPS;

    if (last) {
      const lastWeight = convert(last.weight ?? 0, last.unit ?? "kg", unit);
      const rounded = Math.round(lastWeight * 2) / 2;

      weight =
        deload && lastWeight && !bodyweight
          ? roundTo(lastWeight * DELOAD_LOAD_FACTOR, step)
          : rounded + (progressed ? step : 0);
      reps = progressed ? bottomReps(target?.reps) || last.reps : last.reps;
    }

    return { id: newId(), reps, weight, unit, completed: false };
  });

  const tip = target?.tip ?? input.fallbackTip ?? "";

  return {
    id: newId(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets,
    ...(bodyweight ? { bodyweight: true } : {}),
    ...(tip ? { tip } : {}),
    ...(progressed ? { progressed: true } : {}),
  };
}

/** A new, unfinished session. `exercises` are already built. */
export function buildSession(input: {
  name: string;
  /** Local "YYYY-MM-DD" the session belongs to. */
  date: string;
  exercises: WorkoutExercise[];
  planId?: string;
  dayId?: string;
  deload?: boolean;
  bodyweightKg?: number;
  /** Logged after the fact for a past day. */
  backdated?: boolean;
  now?: Date;
  newId?: () => string;
}): WorkoutSession {
  const now = input.now ?? new Date();
  const startedAt = input.backdated
    ? timestampForKey(input.date, "12:00")
    : now.toISOString();

  return {
    id: (input.newId ?? createId)(),
    name: input.name,
    startedAt,
    exercises: input.exercises,
    date: input.date,
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.dayId ? { dayId: input.dayId } : {}),
    ...(input.deload ? { deload: true } : {}),
    ...(input.bodyweightKg ? { bodyweightKg: input.bodyweightKg } : {}),
    ...(input.backdated ? { backdated: true } : {}),
    lastActivityAt: now.toISOString(),
  };
}

/** Link a plan day's superset flags into session group ids. */
export function applySupersets(
  day: Pick<PlanDay, "exercises">,
  exercises: WorkoutExercise[],
  newId: () => string = createId,
): WorkoutExercise[] {
  const out = exercises.map((exercise) => ({ ...exercise }));

  day.exercises.forEach((planned, index) => {
    const next = out[index + 1];
    const current = out[index];

    if (planned.superset && current && next) {
      const group = current.group ?? newId();

      current.group = group;
      next.group = group;
    }
  });

  return out;
}
