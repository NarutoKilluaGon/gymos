export type MuscleHierarchyGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Arms"
  | "Legs"
  | "Core";

export const MUSCLES_BY_GROUP: Record<MuscleHierarchyGroup, readonly string[]> = {
  Chest: [
    "Upper Chest",
    "Mid Chest",
    "Lower Chest",
    "Pectoralis Major",
    "Pectoralis Minor",
  ],
  Back: [
    "Lats",
    "Upper Back",
    "Rhomboids",
    "Traps",
    "Lower Back",
    "Erector Spinae",
  ],
  Shoulders: [
    "Front Delts",
    "Side Delts",
    "Rear Delts",
    "Rotator Cuff",
  ],
  Arms: [
    "Biceps",
    "Triceps",
    "Forearms",
    "Brachialis",
  ],
  Legs: [
    "Quads",
    "Hamstrings",
    "Glutes",
    "Calves",
    "Adductors",
    "Abductors",
  ],
  Core: [
    "Abs",
    "Obliques",
    "Lower Abs",
    "Transverse Abdominis",
  ],
};

/**
 * Standardize or map common muscle strings into clean display names.
 */
export function normalizeMuscleName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  // Common synonyms / anatomical mappings
  if (lower.includes("pectoralis major") || lower === "pecs" || lower === "chest") return "Pectoralis Major";
  if (lower.includes("clavicular") || lower === "upper chest") return "Upper Chest";
  if (lower === "lower chest") return "Lower Chest";
  if (lower.includes("latissimus") || lower === "lats" || lower === "lat") return "Lats";
  if (lower.includes("rhomboid")) return "Rhomboids";
  if (lower.includes("trapezius") || lower === "traps" || lower === "trap") return "Traps";
  if (lower.includes("erector") || lower === "lower back") return "Lower Back";
  if (lower.includes("anterior deltoid") || lower === "front delt" || lower === "front delts") return "Front Delts";
  if (lower.includes("lateral deltoid") || lower === "side delt" || lower === "side delts" || lower === "lateral delts") return "Side Delts";
  if (lower.includes("posterior deltoid") || lower === "rear delt" || lower === "rear delts") return "Rear Delts";
  if (lower.includes("biceps brachii") || lower === "biceps" || lower === "bicep") return "Biceps";
  if (lower.includes("triceps brachii") || lower === "triceps" || lower === "tricep") return "Triceps";
  if (lower.includes("brachialis")) return "Brachialis";
  if (lower.includes("brachioradialis") || lower.includes("forearm")) return "Forearms";
  if (lower.includes("quadriceps") || lower === "quads" || lower === "quad") return "Quads";
  if (lower.includes("hamstring")) return "Hamstrings";
  if (lower.includes("gluteus") || lower === "glutes" || lower === "glute") return "Glutes";
  if (lower.includes("gastrocnemius") || lower.includes("soleus") || lower === "calves" || lower === "calf") return "Calves";
  if (lower.includes("adductor")) return "Adductors";
  if (lower.includes("abductor")) return "Abductors";
  if (lower.includes("rectus abdominis") || lower === "abs" || lower === "upper abs") return "Abs";
  if (lower.includes("oblique")) return "Obliques";
  if (lower.includes("transverse abdominis")) return "Transverse Abdominis";

  // Return title-cased or trimmed as-is
  return trimmed;
}
