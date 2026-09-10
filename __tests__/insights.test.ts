import { buildInsightLines } from "@/services/insights";
import type { WeekStats } from "@/types/insights";

function stats(overrides: Partial<WeekStats> = {}): WeekStats {
  return {
    startDate: "2026-09-07",
    endDate: "2026-09-13",
    workoutDays: 0,
    workouts: 0,
    minutes: 0,
    weightLatest: null,
    weightUnit: null,
    weightChange: null,
    caloriesAverage: null,
    calorieDays: 0,
    journalCount: 0,
    ...overrides,
  };
}

describe("buildInsightLines", () => {
  it("suggests a workout when none are logged this week", () => {
    const lines = buildInsightLines({
      current: stats(),
      previous: stats(),
    });

    expect(lines).toContain("No workouts logged this week yet.");
  });

  it("reports trained days when last week was empty", () => {
    const lines = buildInsightLines({
      current: stats({ workoutDays: 2, workouts: 2 }),
      previous: stats(),
    });

    expect(lines).toContain(
      "You trained 2 days this week.",
    );
  });

  it("compares against last week when both are active", () => {
    const lines = buildInsightLines({
      current: stats({ workoutDays: 4, workouts: 4 }),
      previous: stats({ workoutDays: 2, workouts: 2 }),
    });

    expect(lines).toContain(
      "You trained 4 days this week — +2 vs last week.",
    );
  });

  it("reports a negative delta vs last week", () => {
    const lines = buildInsightLines({
      current: stats({ workoutDays: 1, workouts: 1 }),
      previous: stats({ workoutDays: 3, workouts: 3 }),
    });

    expect(lines).toContain(
      "You trained 1 day this week — -2 vs last week.",
    );
  });

  it("notes weight movement with its unit", () => {
    const lines = buildInsightLines({
      current: stats({ weightChange: -1.2, weightUnit: "kg" }),
      previous: stats(),
    });

    expect(lines).toContain("Weight moved -1.2 kg this week.");
  });

  it("keeps weight line out when no weight is logged", () => {
    const lines = buildInsightLines({
      current: stats({ workoutDays: 1 }),
      previous: stats(),
    });

    expect(lines.some((line) => line.includes("Weight"))).toBe(false);
  });

  it("averages calories across logged days", () => {
    const lines = buildInsightLines({
      current: stats({ calorieDays: 3, caloriesAverage: 2150 }),
      previous: stats(),
    });

    expect(lines).toContain(
      "Average 2150 kcal/day across 3 logged days.",
    );
  });

  it("omits the calorie line for a single logged day", () => {
    const lines = buildInsightLines({
      current: stats({ calorieDays: 1 }),
      previous: stats(),
    });

    expect(lines.some((line) => line.includes("kcal/day"))).toBe(false);
  });
});