import type { Measurement } from "@/types/gymos";
import { daysBetweenKeys, dateKeyFromTimestamp } from "@/utils/date";

const KG_PER_LB = 0.45359237;

export type WeightUnit = "kg" | "lb";

export type WeightPoint = {
  /** Local "YYYY-MM-DD". */
  key: string;
  kg: number;
  /** Measurement id of the reading that represents this day. */
  id: string;
};

export function toKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value * KG_PER_LB : value;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}

/** "72.4 kg" / "159.6 lb" */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${Math.round(fromKg(kg, unit) * 10) / 10} ${unit}`;
}

/**
 * One point per local day (the last reading of the day), oldest first,
 * always in kg regardless of the unit each reading was saved in.
 */
export function weightPoints(
  measurements: readonly Measurement[],
): WeightPoint[] {
  const byDay = new Map<string, { at: number; point: WeightPoint }>();

  for (const measurement of measurements) {
    if (measurement.type !== "weight") continue;
    if (!Number.isFinite(measurement.value) || measurement.value <= 0) continue;

    const key = dateKeyFromTimestamp(measurement.timestamp);

    if (!key) continue;

    const at = new Date(measurement.timestamp).getTime();
    const kg = toKg(
      measurement.value,
      measurement.unit === "lb" ? "lb" : "kg",
    );
    const existing = byDay.get(key);

    if (!existing || at >= existing.at) {
      byDay.set(key, { at, point: { key, kg, id: measurement.id } });
    }
  }

  return [...byDay.values()]
    .map((entry) => entry.point)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function weightChange(
  points: readonly WeightPoint[],
): { deltaKg: number; sinceKey: string } | null {
  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last || points.length < 2) return null;

  return { deltaKg: last.kg - first.kg, sinceKey: first.key };
}

/** kg/week across the points, or null unless they span at least 6 days. */
export function weeklySlope(points: readonly WeightPoint[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last || points.length < 2) return null;

  const days = daysBetweenKeys(first.key, last.key);

  if (days < 6) return null;

  return ((last.kg - first.kg) / days) * 7;
}

/** ~7700 kcal per kg of body weight, spread over 7 days. */
const KCAL_PER_KG_PER_WEEK_PER_DAY = 1100;
const ADAPT_DEADBAND_KG_PER_WEEK = 0.15;
const ADAPT_STEP_KCAL = 50;

/**
 * Daily-calorie change that would move the observed weekly trend toward
 * the goal, in 50 kcal steps; 0 when already within 0.15 kg/week.
 */
export function suggestCalorieAdjustment(
  goalKgPerWeek: number,
  observedKgPerWeek: number,
): number {
  const difference = goalKgPerWeek - observedKgPerWeek;

  if (Math.abs(difference) <= ADAPT_DEADBAND_KG_PER_WEEK) return 0;

  return (
    Math.round(
      (difference * KCAL_PER_KG_PER_WEEK_PER_DAY) / ADAPT_STEP_KCAL,
    ) * ADAPT_STEP_KCAL
  );
}
