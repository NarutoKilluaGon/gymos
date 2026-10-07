import { EXERCISES, type MuscleGroup } from "@/data/exercises";
import { FORGE_LIBRARY } from "@/data/forge-library";
import type { CatalogExercise, CustomExercise } from "@/types/forge";

/** Forge and the core catalogue spell a few lifts differently. */
const ALIASES: Record<string, string> = {
  "biceps curl": "bicep curl",
  "triceps pushdown": "tricep pushdown",
  "calf raise": "standing calf raise",
  "cable fly": "pec fly",
};

const BODYWEIGHT_NAME =
  /pull.?up|chin.?up|push.?up|\bdips?\b|plank|sit.?up|crunch|burpee|muscle.?up|inverted row|pike|handstand|hanging|leg raise|bodyweight|\bbw\b/i;

export const normalizeName = (name: string): string => {
  const key = name.trim().toLowerCase();

  return ALIASES[key] ?? key;
};

export function looksBodyweight(name: string): boolean {
  return BODYWEIGHT_NAME.test(name);
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Every exercise Forge can offer: the core catalogue (ids unchanged, so
 * history and PRs keep matching), Forge's library entries the core lacks
 * (id `lib-<slug>`), then the user's own. Forge's cues and bodyweight
 * flags are layered onto matching core entries.
 */
export function buildCatalog(
  custom: readonly CustomExercise[] = [],
): CatalogExercise[] {
  const byName = new Map<string, CatalogExercise>();

  for (const entry of EXERCISES) {
    byName.set(normalizeName(entry.name), {
      id: entry.id,
      name: entry.name,
      muscleGroup: entry.muscleGroup,
      bodyweight:
        entry.equipment === "bodyweight" || looksBodyweight(entry.name),
      ...(entry.instructions ? { how: entry.instructions } : {}),
    });
  }

  for (const lib of FORGE_LIBRARY) {
    const key = normalizeName(lib.name);
    const existing = byName.get(key);

    if (existing) {
      byName.set(key, {
        ...existing,
        bodyweight: lib.bodyweight || existing.bodyweight,
        secondary: lib.secondary,
        how: lib.how,
      });
    } else {
      byName.set(key, {
        id: `lib-${slug(lib.name)}`,
        name: lib.name,
        muscleGroup: lib.muscleGroup,
        bodyweight: lib.bodyweight,
        secondary: lib.secondary,
        how: lib.how,
      });
    }
  }

  for (const own of custom) {
    byName.set(normalizeName(own.name), {
      id: own.id,
      name: own.name,
      muscleGroup: own.muscleGroup,
      bodyweight: own.bodyweight,
      custom: true,
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findExercise(
  catalog: readonly CatalogExercise[],
  idOrName: string,
): CatalogExercise | undefined {
  const key = normalizeName(idOrName);

  return catalog.find(
    (entry) => entry.id === idOrName || normalizeName(entry.name) === key,
  );
}

export const MUSCLE_ORDER: readonly MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];
