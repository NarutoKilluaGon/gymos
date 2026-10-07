import type { MuscleGroup } from "@/data/exercises";
import { findExercise, MUSCLE_ORDER } from "@/services/forge/catalog";
import { sessionsInLast } from "@/services/forge/history";
import { workSets } from "@/services/forge/load";
import type { CatalogExercise } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";

export type MuscleShare = {
  group: MuscleGroup;
  sets: number;
  /** 0..1 share of all counted sets. */
  share: number;
};

/** Work sets per muscle group over the last `days` days. Exercises that
 *  can't be placed in a group are skipped rather than guessed. */
export function muscleBalance(
  sessions: readonly WorkoutSession[],
  catalog: readonly CatalogExercise[],
  days: number,
  now: Date,
): MuscleShare[] {
  const counts = new Map<MuscleGroup, number>(
    MUSCLE_ORDER.map((group) => [group, 0]),
  );

  for (const session of sessionsInLast(sessions, days, now)) {
    for (const exercise of session.exercises) {
      const found = findExercise(catalog, exercise.exerciseId);

      if (!found) continue;

      counts.set(
        found.muscleGroup,
        (counts.get(found.muscleGroup) ?? 0) + workSets(exercise).length,
      );
    }
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return MUSCLE_ORDER.map((group) => ({
    group,
    sets: counts.get(group) ?? 0,
    share: total > 0 ? (counts.get(group) ?? 0) / total : 0,
  }));
}
