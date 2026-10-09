import { convert, round1, type WeightUnit } from "@/services/forge/load";
import type { WorkoutSet } from "@/types/gymos";

/**
 * Returns singular or plural form based on count:
 * plural(1, "set") -> "1 set"
 * plural(3, "set") -> "3 sets"
 * plural(0, "set") -> "0 sets"
 */
export function plural(count: number, word: string, pluralForm?: string): string {
  const form = count === 1 ? word : pluralForm ?? `${word}s`;
  return `${count} ${form}`;
}

/**
 * Format numbers with thousands separators and optional decimals.
 * Integers are cleanly shown without .0 (e.g. 8000 -> "8,000", 2.12 -> "2.1").
 */
export function formatNumber(
  n: number,
  options?: { min?: number; max?: number },
): string {
  if (!Number.isFinite(n)) return "0";
  const max = options?.max ?? 1;
  const min = options?.min ?? 0;

  const rounded = Number(n.toFixed(max));
  const isInt = Number.isInteger(rounded);

  const formattedValue = isInt && min === 0
    ? rounded.toLocaleString("en-US")
    : rounded.toLocaleString("en-US", {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
      });

  return formattedValue;
}

/**
 * Formats durations in human-readable notation:
 * formatDuration(120_000) -> "2 min"
 * formatDuration(2_820_000) -> "47 min"
 * formatDuration(3_900_000) -> "1 h 05 min"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 min";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hours} h ${paddedMins} min`;
}

/**
 * Formats weights with units cleanly:
 * formatWeight(35, "kg") -> "35 kg"
 * formatWeight(27.5, "kg") -> "27.5 kg"
 */
export function formatWeight(val: number, unit: WeightUnit = "kg"): string {
  if (!Number.isFinite(val)) return `0 ${unit}`;
  const rounded = round1(val);
  return `${rounded} ${unit}`;
}

/**
 * Grouped set notation across GymOS:
 * Compresses identical consecutive sets:
 * e.g. [{ weight: 35, reps: 20 }, { weight: 35, reps: 20 }, { weight: 35, reps: 20 }] -> "3 × 20 @ 35 kg"
 * Mixed sets: "35 kg × 20, 30 kg × 12"
 */
export function formatSetGroup(
  sets: readonly WorkoutSet[],
  unit: WeightUnit = "kg",
  bodyweight = false,
): string {
  if (!sets || sets.length === 0) return "0 sets";

  // Check if all sets are identical in weight and reps
  const first = sets[0];
  const firstWeight = round1(convert(first.weight ?? 0, first.unit ?? "kg", unit));
  const firstReps = first.reps ?? 0;

  const allIdentical = sets.every((s) => {
    const w = round1(convert(s.weight ?? 0, s.unit ?? "kg", unit));
    return w === firstWeight && (s.reps ?? 0) === firstReps;
  });

  if (allIdentical) {
    if (bodyweight) {
      const extra = firstWeight ? `${firstWeight > 0 ? "+" : "−"}${Math.abs(firstWeight)} ${unit}` : "";
      return extra
        ? `${sets.length} × ${firstReps} @ BW ${extra}`
        : `${sets.length} × ${firstReps} @ BW`;
    }
    const loadStr = firstWeight > 0 ? ` @ ${firstWeight} ${unit}` : "";
    return `${sets.length} × ${firstReps}${loadStr}`;
  }

  // Mixed sets
  return sets
    .map((s) => {
      const w = round1(convert(s.weight ?? 0, s.unit ?? "kg", unit));
      const r = s.reps ?? 0;
      if (bodyweight) {
        const extra = w ? `${w > 0 ? "+" : "−"}${Math.abs(w)} ${unit}` : "";
        return `BW${extra ? ` ${extra}` : ""} × ${r}`;
      }
      return w > 0 ? `${w} ${unit} × ${r}` : `${r} reps`;
    })
    .join(", ");
}

/**
 * Format plan exercise target using the standard notation:
 * formatPlanTarget({ sets: 3, reps: "8-10", weight: 60 }, "kg") -> "3 × 8-10 @ 60 kg"
 * formatPlanTarget({ sets: 3, reps: "12" }) -> "3 × 12"
 */
export function formatPlanTarget(
  exercise: { sets: number; reps: string; weight?: number },
  unit: WeightUnit = "kg",
): string {
  const load = exercise.weight ? round1(convert(exercise.weight, "kg", unit)) : 0;
  return load > 0
    ? `${exercise.sets} × ${exercise.reps} @ ${load} ${unit}`
    : `${exercise.sets} × ${exercise.reps}`;
}

/**
 * Capitalizes display names while keeping uppercase acronyms intact:
 * displayName("back extension") -> "Back Extension"
 * displayName("lat pulldown") -> "Lat Pulldown"
 * displayName("EZ bar curl") -> "EZ Bar Curl"
 * displayName("DB press") -> "DB Press"
 */
export function displayName(name: string): string {
  if (!name) return "";
  const ACRONYMS = new Set(["DB", "EZ", "BB", "RDL", "AMRAP", "BW", "PR", "HIIT"]);

  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Capitalize first character, keep rest lowercase if whole word was lowercase or mixed
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
