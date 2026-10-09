import type { MuscleGroup } from "@/data/exercises";
import { normalizeMuscleName } from "@/data/muscles";
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
  /** Detailed breakdown by specific muscle within this group. */
  muscles: Record<string, number>;
};

export type MuscleBalanceResult = {
  groups: MuscleShare[];
  /** Per-muscle breakdown across all exercises. */
  muscles: Record<string, number>;
};

/** Work sets per muscle group and per muscle over the last `days` days. Exercises that
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
  const groupMuscles = new Map<MuscleGroup, Map<string, number>>(
    MUSCLE_ORDER.map((group) => [group, new Map()]),
  );

  for (const session of sessionsInLast(sessions, days, now)) {
    for (const exercise of session.exercises) {
      const found = findExercise(catalog, exercise.exerciseId);

      if (!found) continue;

      const setCount = workSets(exercise).length;
      counts.set(
        found.muscleGroup,
        (counts.get(found.muscleGroup) ?? 0) + setCount,
      );

      const targetGroupMap = groupMuscles.get(found.muscleGroup);
      if (targetGroupMap) {
        const primaryMuscles = found.primaryMuscles ?? [];
        if (primaryMuscles.length > 0) {
          for (const rawMuscle of primaryMuscles) {
            const m = normalizeMuscleName(rawMuscle);
            targetGroupMap.set(m, (targetGroupMap.get(m) ?? 0) + setCount);
          }
        } else {
          // If no specific muscle is tagged, attribute to group name
          const def = found.muscleGroup;
          targetGroupMap.set(def, (targetGroupMap.get(def) ?? 0) + setCount);
        }
      }
    }
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return MUSCLE_ORDER.map((group) => {
    const rawMap = groupMuscles.get(group) ?? new Map();
    const musclesObj: Record<string, number> = {};
    for (const [mName, mSets] of rawMap.entries()) {
      musclesObj[mName] = mSets;
    }

    return {
      group,
      sets: counts.get(group) ?? 0,
      share: total > 0 ? (counts.get(group) ?? 0) / total : 0,
      muscles: musclesObj,
    };
  });
}

/** Per-muscle total breakdown helper. */
export function perMuscleBreakdown(
  sessions: readonly WorkoutSession[],
  catalog: readonly CatalogExercise[],
  days: number,
  now: Date,
): Record<string, number> {
  const shares = muscleBalance(sessions, catalog, days, now);
  const result: Record<string, number> = {};
  for (const share of shares) {
    for (const [m, count] of Object.entries(share.muscles)) {
      result[m] = (result[m] ?? 0) + count;
    }
  }
  return result;
}
