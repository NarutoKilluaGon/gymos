import {
  fromKg,
  weightPoints,
  type WeightUnit,
} from "@/services/nourish/weight";
import type {
  Measurement,
  MeasurementType,
  MeasurementUnit,
} from "@/types/gymos";
import { daysBetweenKeys, dateKeyFromTimestamp } from "@/utils/date";

export type ChartSeriesPoint = {
  /** Measurement id of the reading this point draws. */
  id: string;
  /** Local "YYYY-MM-DD" of the reading (used for the axis labels). */
  key: string;
  /** Value in `MeasurementSeries.unit`. */
  value: number;
  /** Horizontal position, 0 (first point) .. 1 (last point). */
  x: number;
};

export type MeasurementSeries = {
  unit: MeasurementUnit;
  points: ChartSeriesPoint[];
};

/** Keeps converted lb values from showing float noise (159.60000000000002). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bodyweight series for the Progress chart.
 *
 * - One point per local day (the last reading of that day), so two weigh-ins
 *   on one day never draw two dots.
 * - Readings are converted to kg with the app's one conversion
 *   (`toKg`/`fromKg`) and plotted in the unit of the most recent reading,
 *   so the line, CURRENT and CHANGE agree. Stored values are never touched.
 * - `x` is proportional to the calendar-day distance from the first point,
 *   so a missing stretch of days shows up as a gap rather than being squeezed
 *   out. A single point (or all points on one day) sits in the middle.
 * - Non-positive / non-finite / non-weight / bad-timestamp readings are
 *   dropped instead of being plotted as zero.
 */
export function weightChartSeries(
  measurements: readonly Measurement[],
): MeasurementSeries | null {
  const points = weightPoints(measurements);
  const last = points[points.length - 1];

  if (!last) return null;

  const lastReading = measurements.find((m) => m.id === last.id);
  const unit: WeightUnit = lastReading?.unit === "lb" ? "lb" : "kg";

  const first = points[0];
  const span = daysBetweenKeys(first.key, last.key);

  return {
    unit,
    points: points.map((point) => ({
      id: point.id,
      key: point.key,
      value: round2(fromKg(point.kg, unit)),
      x: span === 0 ? 0.5 : daysBetweenKeys(first.key, point.key) / span,
    })),
  };
}

/**
 * Circumference charts (biceps, chest, ...) keep their existing behaviour:
 * every reading, evenly spaced, in the unit of the latest reading.
 */
function evenlySpacedSeries(
  measurements: readonly Measurement[],
): MeasurementSeries | null {
  const valid = measurements.filter(
    (m) => Number.isFinite(m.value) && dateKeyFromTimestamp(m.timestamp),
  );
  const last = valid[valid.length - 1];

  if (!last) return null;

  return {
    unit: last.unit,
    points: valid.map((m, index) => ({
      id: m.id,
      key: dateKeyFromTimestamp(m.timestamp) as string,
      value: m.value,
      x: valid.length === 1 ? 0.5 : index / (valid.length - 1),
    })),
  };
}

export function measurementChartSeries(
  type: MeasurementType | undefined,
  measurements: readonly Measurement[],
): MeasurementSeries | null {
  return type === "weight"
    ? weightChartSeries(measurements)
    : evenlySpacedSeries(measurements);
}
