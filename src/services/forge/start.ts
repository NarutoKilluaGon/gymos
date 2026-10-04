import {
  applySupersets,
  buildExercise,
  buildSession,
} from "@/services/forge/build";
import { findExercise, looksBodyweight } from "@/services/forge/catalog";
import { previousSets } from "@/services/forge/history";
import type { WeightUnit } from "@/services/forge/load";
import type { CatalogExercise, Plan, PlanDay } from "@/types/forge";
import type { WorkoutExercise, WorkoutSession } from "@/types/gymos";
import { createId } from "@/utils/id";

/** A stand-in for the not-yet-created session, used only to ask "what did
 *  I do last time?" relative to when this one starts. */
function placeholder(date: string, now: Date): WorkoutSession {
  return {
    id: "__new__",
    name: "",
    date,
    startedAt: now.toISOString(),
    exercises: [],
  };
}

/** Resolve a plan/library reference to a catalog entry, falling back to a
 *  minimal one so an exercise that was later removed still works. */
export function resolveExercise(
  catalog: readonly CatalogExercise[],
  ref: { exerciseId?: string; name: string },
): CatalogExercise {
  return (
    (ref.exerciseId ? findExercise(catalog, ref.exerciseId) : undefined) ??
    findExercise(catalog, ref.name) ?? {
      id: ref.exerciseId || `custom-${ref.name.toLowerCase()}`,
      name: ref.name,
      muscleGroup: "Core",
      bodyweight: looksBodyweight(ref.name),
    }
  );
}

/** One exercise ready to add to a running session. */
export function exerciseForSession(input: {
  exercise: CatalogExercise;
  sessions: readonly WorkoutSession[];
  session: Pick<WorkoutSession, "date" | "startedAt" | "deload">;
  unit: WeightUnit;
  newId?: () => string;
}): WorkoutExercise {
  const now = new Date(input.session.startedAt);
  const prev = previousSets(
    input.sessions,
    input.exercise.id,
    placeholder(input.session.date ?? "", now),
  );

  return buildExercise({
    exercise: input.exercise,
    previous: prev?.sets ?? null,
    deload: Boolean(input.session.deload),
    unit: input.unit,
    ...(input.exercise.how
      ? { fallbackTip: input.exercise.how.split(".")[0] ?? "" }
      : {}),
    ...(input.newId ? { newId: input.newId } : {}),
  });
}

/**
 * Start a session. With a plan `day` its exercises are prefilled (from the
 * plan target and last time, with progression/deload applied); without
 * one it starts empty. `backdated` logs it against a past `date`.
 */
export function startSession(input: {
  day: PlanDay | null;
  plan?: Plan;
  date: string;
  catalog: readonly CatalogExercise[];
  sessions: readonly WorkoutSession[];
  unit: WeightUnit;
  bodyweightKg?: number;
  backdated?: boolean;
  now?: Date;
  newId?: () => string;
}): WorkoutSession {
  const now = input.now ?? new Date();
  const newId = input.newId ?? createId;
  const deload = Boolean(input.plan?.deload);
  const reference = placeholder(input.date, now);

  const built = (input.day?.exercises ?? []).map((planned) => {
    const exercise = resolveExercise(input.catalog, planned);
    const prev = previousSets(input.sessions, exercise.id, reference);

    return buildExercise({
      exercise,
      target: planned,
      previous: prev?.sets ?? null,
      deload,
      unit: input.unit,
      newId,
    });
  });
  const exercises = input.day ? applySupersets(input.day, built, newId) : built;

  return buildSession({
    name: input.day?.name ?? "Workout",
    date: input.date,
    exercises,
    ...(input.plan && input.day
      ? { planId: input.plan.id, dayId: input.day.id }
      : {}),
    deload,
    ...(input.bodyweightKg ? { bodyweightKg: input.bodyweightKg } : {}),
    ...(input.backdated ? { backdated: true } : {}),
    now,
    newId,
  });
}
