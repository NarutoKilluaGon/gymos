import { EXERCISES, type MuscleGroup } from "@/data/exercises";
import { FORGE_LIBRARY } from "@/data/forge-library";
import { normalizeMuscleName } from "@/data/muscles";
import type { CatalogExercise, CustomExercise, LoadType } from "@/types/forge";

/** Forge and the core catalogue spell a few lifts differently. */
const ALIASES: Record<string, string> = {
  "biceps curl": "bicep curl",
  "triceps pushdown": "tricep pushdown",
  "calf raise": "standing calf raise",
  "cable fly": "pec fly",
  "hyperextension": "back extension",
  "hyperextensions": "back extension",
  "lat pull": "lat pulldown",
  "skullcrusher": "skull crusher",
  "skullcrushers": "skull crusher",
  "rdl": "romanian deadlift",
  "bench": "bench press",
  "db bench": "dumbbell bench press",
  "ohp": "overhead press",
  "military press": "overhead press",
  "cgbp": "close-grip bench press",
  "bss": "bulgarian split squat",
  "chins": "chin-up",
  "pullups": "pull-up",
  "pushups": "push-up",
  "dips": "dip",
};

const BODYWEIGHT_NAME =
  /pull.?up|chin.?up|push.?up|\bdips?\b|plank|sit.?up|crunch|burpee|muscle.?up|inverted row|pike|handstand|hanging|leg raise|bodyweight|\bbw\b/i;

/** Strip punctuation, collapse spaces, handle plurals and hyphens. */
export function cleanSearchToken(text: string): string {
  let s = text.toLowerCase().trim();
  s = s.replace(/[-_]/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // Simple plural stripping for search token matching: "curls" -> "curl", "raises" -> "raise"
  if (s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.endsWith("es") && !s.endsWith("ches") && !s.endsWith("shes")) s = s.slice(0, -2);
  else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

export const normalizeName = (name: string): string => {
  const key = name.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  const cleaned = cleanSearchToken(name);
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  return key;
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
 * Infer loadType from equipment or bodyweight flag.
 */
function inferLoadType(
  name: string,
  equipment?: string,
  isBw?: boolean,
): LoadType | undefined {
  if (equipment === "barbell") return "barbell";
  if (equipment === "dumbbell") return "dumbbell";
  if (equipment === "cable") return "cable";
  if (equipment === "machine" || equipment === "smith-machine") return "machine";
  if (equipment === "bodyweight" || isBw || looksBodyweight(name)) return "bodyweight";
  return undefined;
}

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
    const isBw = entry.equipment === "bodyweight" || looksBodyweight(entry.name);
    const primMuscles = entry.primaryMuscles?.map(normalizeMuscleName) ?? [];
    byName.set(normalizeName(entry.name), {
      id: entry.id,
      name: entry.name,
      muscleGroup: entry.muscleGroup,
      bodyweight: isBw,
      loadType: inferLoadType(entry.name, entry.equipment, isBw),
      primaryMuscles: primMuscles.length > 0 ? primMuscles : undefined,
      ...(entry.instructions ? { how: entry.instructions } : {}),
    });
  }

  for (const lib of FORGE_LIBRARY) {
    const key = normalizeName(lib.name);
    const existing = byName.get(key);

    const isBw = lib.bodyweight || (existing ? existing.bodyweight : false);
    const loadType = lib.loadType ?? existing?.loadType ?? (isBw ? "bodyweight" : undefined);
    const primaryMuscles = lib.primaryMuscles ?? existing?.primaryMuscles;
    const aliases = lib.aliases ?? existing?.aliases;

    if (existing) {
      byName.set(key, {
        ...existing,
        bodyweight: isBw,
        loadType,
        primaryMuscles: primaryMuscles ? [...primaryMuscles] : undefined,
        aliases: aliases ? [...aliases] : undefined,
        secondary: lib.secondary,
        how: lib.how,
      });
    } else {
      byName.set(key, {
        id: `lib-${slug(lib.name)}`,
        name: lib.name,
        muscleGroup: lib.muscleGroup,
        bodyweight: lib.bodyweight,
        loadType,
        primaryMuscles: primaryMuscles ? [...primaryMuscles] : undefined,
        aliases: aliases ? [...aliases] : undefined,
        secondary: lib.secondary,
        how: lib.how,
      });
    }
  }

  for (const own of custom) {
    const isBw = own.loadType === "bodyweight" || own.loadType === "assisted" || own.bodyweight;
    byName.set(normalizeName(own.name), {
      id: own.id,
      name: own.name,
      muscleGroup: own.muscleGroup,
      bodyweight: isBw,
      loadType: own.loadType ?? (isBw ? "bodyweight" : undefined),
      primaryMuscles: own.primaryMuscles,
      custom: true,
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Check if query matches exercise via name or aliases. */
export function exerciseMatchesQuery(entry: CatalogExercise, query: string): boolean {
  if (!query) return true;
  const qClean = cleanSearchToken(query);
  const qNorm = normalizeName(query);

  const nameClean = cleanSearchToken(entry.name);
  if (nameClean.includes(qClean) || entry.name.toLowerCase().includes(query.toLowerCase())) {
    return true;
  }

  if (entry.aliases) {
    for (const a of entry.aliases) {
      if (cleanSearchToken(a).includes(qClean) || a.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
    }
  }

  // Check if alias map resolves query to this exercise
  if (normalizeName(entry.name) === qNorm) {
    return true;
  }

  return false;
}

/**
 * Find near-duplicate exercise in catalog:
 * returns matched catalog exercise if there's high similarity or alias collision.
 */
export function findSimilarExercise(
  catalog: readonly CatalogExercise[],
  name: string,
): CatalogExercise | undefined {
  const targetClean = cleanSearchToken(name);
  const targetNorm = normalizeName(name);

  for (const entry of catalog) {
    const entryClean = cleanSearchToken(entry.name);
    const entryNorm = normalizeName(entry.name);

    if (entryClean === targetClean || entryNorm === targetNorm) {
      return entry;
    }

    if (entry.aliases) {
      for (const a of entry.aliases) {
        if (cleanSearchToken(a) === targetClean || normalizeName(a) === targetNorm) {
          return entry;
        }
      }
    }
  }

  return undefined;
}

export function findExercise(
  catalog: readonly CatalogExercise[],
  idOrName: string,
): CatalogExercise | undefined {
  const key = normalizeName(idOrName);

  return catalog.find(
    (entry) =>
      entry.id === idOrName ||
      normalizeName(entry.name) === key ||
      (entry.aliases && entry.aliases.some((a) => normalizeName(a) === key)),
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
