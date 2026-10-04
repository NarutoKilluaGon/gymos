import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";

export type WeightUnit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

export const DEFAULT_BODYWEIGHT_KG = 70;

export const toKg = (value: number, unit: WeightUnit): number =>
  unit === "lb" ? value * KG_PER_LB : value;

export const fromKg = (kg: number, unit: WeightUnit): number =>
  unit === "lb" ? kg / KG_PER_LB : kg;

export const convert = (
  value: number,
  from: WeightUnit,
  to: WeightUnit,
): number => (from === to ? value : fromKg(toKg(value, from), to));

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** A completed, non-warm-up set: the only kind that counts. */
export const isWorkSet = (set: WorkoutSet): boolean =>
  set.completed && !set.warmup;

export const workSets = (exercise: WorkoutExercise): WorkoutSet[] =>
  exercise.sets.filter(isWorkSet);

/** The set's weight in kg (extra load for bodyweight exercises). */
export const setWeightKg = (set: WorkoutSet): number =>
  toKg(set.weight ?? 0, set.unit ?? "kg");

/** Total load moved, kg. Bodyweight exercises add body weight (never below
 *  zero, so a heavily assisted set can't go negative). */
export function loadKg(
  session: Pick<WorkoutSession, "bodyweightKg">,
  exercise: Pick<WorkoutExercise, "bodyweight">,
  set: WorkoutSet,
): number {
  const extra = setWeightKg(set);

  return exercise.bodyweight
    ? Math.max(0, (session.bodyweightKg || DEFAULT_BODYWEIGHT_KG) + extra)
    : extra;
}

/** Epley estimated-1RM style score; reps alone when there is no load. */
export function score(
  session: Pick<WorkoutSession, "bodyweightKg">,
  exercise: Pick<WorkoutExercise, "bodyweight">,
  set: WorkoutSet,
): number {
  const load = loadKg(session, exercise, set);

  return load ? load * (1 + set.reps / 30) : set.reps;
}

export function bestSet(
  session: Pick<WorkoutSession, "bodyweightKg">,
  exercise: WorkoutExercise,
): WorkoutSet | undefined {
  return [...workSets(exercise)].sort(
    (a, b) => score(session, exercise, b) - score(session, exercise, a),
  )[0];
}

/** Volume (kg × reps over work sets) for a whole session. */
export function sessionVolumeKg(session: WorkoutSession): number {
  return session.exercises.reduce(
    (sum, exercise) =>
      sum +
      workSets(exercise).reduce(
        (inner, set) => inner + loadKg(session, exercise, set) * set.reps,
        0,
      ),
    0,
  );
}

/** "60×8", "BW×12", "BW+10×5", "BW−20×6". Shown in `unit`. */
export function formatSet(
  exercise: Pick<WorkoutExercise, "bodyweight">,
  set: WorkoutSet,
  unit: WeightUnit,
): string {
  const shown = round1(convert(set.weight ?? 0, set.unit ?? "kg", unit));

  if (exercise.bodyweight) {
    const extra = shown ? `${shown > 0 ? "+" : "−"}${Math.abs(shown)}` : "";

    return `BW${extra}×${set.reps}`;
  }

  return `${shown || "BW"}×${set.reps}`;
}

export const formatSets = (
  exercise: WorkoutExercise,
  unit: WeightUnit,
  onlyWork = true,
): string =>
  (onlyWork ? workSets(exercise) : exercise.sets)
    .map((set) => formatSet(exercise, set, unit))
    .join("  ");
