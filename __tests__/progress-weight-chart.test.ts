import {
  measurementChartSeries,
  weightChartSeries,
} from "@/services/progress-chart";
import type { Measurement, MeasurementUnit } from "@/types/gymos";
import { timestampForKey } from "@/utils/date";

const KG_PER_LB = 0.45359237;

let seq = 0;

/** A reading taken on a local day at a local time (timezone-independent). */
function reading(
  key: string,
  value: number,
  unit: MeasurementUnit = "kg",
  hm = "07:30",
  type: Measurement["type"] = "weight",
): Measurement {
  seq += 1;

  return {
    id: `m${seq}`,
    type,
    value,
    unit,
    timestamp: timestampForKey(key, hm),
  };
}

describe("bodyweight chart series", () => {
  it("returns null for an empty measurement history", () => {
    expect(weightChartSeries([])).toBeNull();
    expect(measurementChartSeries("weight", [])).toBeNull();
  });

  it("returns null when nothing usable is recorded (never plots zero)", () => {
    const series = weightChartSeries([
      reading("2026-06-01", 0),
      reading("2026-06-02", -5),
      reading("2026-06-03", Number.NaN),
      { ...reading("2026-06-04", 80), timestamp: "not-a-date" },
      reading("2026-06-05", 40, "cm", "07:30", "waist"),
    ]);

    expect(series).toBeNull();
  });

  it("plots one recorded weight at its real value, centred", () => {
    const series = weightChartSeries([reading("2026-06-10", 72.4)]);

    expect(series).not.toBeNull();
    expect(series!.unit).toBe("kg");
    expect(series!.points).toHaveLength(1);
    expect(series!.points[0].key).toBe("2026-06-10");
    expect(series!.points[0].value).toBe(72.4);
    expect(series!.points[0].x).toBe(0.5);
  });

  it("maps multiple dates and weights to the right day, oldest first", () => {
    const series = weightChartSeries([
      reading("2026-06-01", 80),
      reading("2026-06-02", 79.5),
      reading("2026-06-03", 79.1),
    ])!;

    expect(series.points.map((p) => [p.key, p.value])).toEqual([
      ["2026-06-01", 80],
      ["2026-06-02", 79.5],
      ["2026-06-03", 79.1],
    ]);
    expect(series.points.map((p) => p.x)).toEqual([0, 0.5, 1]);
  });

  it("orders by date even when the input arrives newest-first or shuffled", () => {
    const series = weightChartSeries([
      reading("2026-06-03", 79.1),
      reading("2026-06-01", 80),
      reading("2026-06-02", 79.5),
    ])!;

    expect(series.points.map((p) => p.key)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    expect(series.points.map((p) => p.value)).toEqual([80, 79.5, 79.1]);
  });

  it("leaves a gap for missing days instead of squeezing points together", () => {
    // 1st, 2nd, then nothing until the 10th.
    const series = weightChartSeries([
      reading("2026-06-01", 80),
      reading("2026-06-02", 79.8),
      reading("2026-06-10", 78),
    ])!;

    expect(series.points).toHaveLength(3);
    expect(series.points[0].x).toBe(0);
    expect(series.points[1].x).toBeCloseTo(1 / 9, 10);
    expect(series.points[2].x).toBe(1);
  });

  it("keeps the spacing right across a month boundary", () => {
    const series = weightChartSeries([
      reading("2026-01-30", 80),
      reading("2026-02-02", 79),
    ])!;

    // Jan 30 -> Feb 2 is 3 days; the middle day would sit at 1/3.
    expect(series.points.map((p) => p.x)).toEqual([0, 1]);
    expect(series.points).toHaveLength(2);
  });

  it("draws one point per day, using the day's last reading", () => {
    const series = weightChartSeries([
      reading("2026-06-01", 81, "kg", "07:00"),
      reading("2026-06-01", 80.2, "kg", "21:00"),
      reading("2026-06-02", 80, "kg", "07:00"),
    ])!;

    expect(series.points).toHaveLength(2);
    expect(series.points[0].value).toBe(80.2);
    expect(series.points[1].value).toBe(80);
  });

  it("ignores non-weight measurements mixed into the history", () => {
    const series = weightChartSeries([
      reading("2026-06-01", 80),
      reading("2026-06-01", 15, "in", "08:00", "biceps"),
      reading("2026-06-02", 79),
    ])!;

    expect(series.points.map((p) => p.value)).toEqual([80, 79]);
  });

  it("plots a mixed kg/lb history in the latest reading's unit", () => {
    const lastIsLb = weightChartSeries([
      reading("2026-06-01", 80, "kg"),
      reading("2026-06-02", 175, "lb"),
    ])!;

    expect(lastIsLb.unit).toBe("lb");
    expect(lastIsLb.points[1].value).toBe(175);
    expect(lastIsLb.points[0].value).toBeCloseTo(80 / KG_PER_LB, 1);

    const lastIsKg = weightChartSeries([
      reading("2026-06-01", 176, "lb"),
      reading("2026-06-02", 79.5, "kg"),
    ])!;

    expect(lastIsKg.unit).toBe("kg");
    expect(lastIsKg.points[1].value).toBe(79.5);
    expect(lastIsKg.points[0].value).toBeCloseTo(176 * KG_PER_LB, 1);
  });

  it("does not modify the stored readings", () => {
    const input = [reading("2026-06-01", 176, "lb"), reading("2026-06-02", 79, "kg")];
    const copy = JSON.parse(JSON.stringify(input));

    weightChartSeries(input);

    expect(input).toEqual(copy);
  });
});

describe("measurementChartSeries routing", () => {
  it("keeps circumference charts evenly spaced and untouched", () => {
    const series = measurementChartSeries("waist", [
      reading("2026-06-01", 34, "in", "07:30", "waist"),
      reading("2026-06-02", 33.5, "in", "07:30", "waist"),
      reading("2026-06-20", 33, "in", "07:30", "waist"),
    ])!;

    expect(series.unit).toBe("in");
    expect(series.points.map((p) => p.value)).toEqual([34, 33.5, 33]);
    expect(series.points.map((p) => p.x)).toEqual([0, 0.5, 1]);
  });

  it("routes weight through the date-accurate series", () => {
    const series = measurementChartSeries("weight", [
      reading("2026-06-01", 80),
      reading("2026-06-02", 79.8),
      reading("2026-06-10", 78),
    ])!;

    expect(series.points[1].x).toBeCloseTo(1 / 9, 10);
  });
});
