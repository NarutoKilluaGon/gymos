import {
  formatDuration,
  formatSetName,
  formatVolume,
  workoutDurationMin,
  workoutSetCount,
  workoutVolume,
} from "@/services/workout-history";
import type { WorkoutSession } from "@/types/gymos";

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "w1",
    name: "Push day",
    startedAt: "2026-09-10T10:00:00.000Z",
    endedAt: "2026-09-10T10:54:00.000Z",
    exercises: [],
    ...overrides,
  };
}

describe("workoutVolume", () => {
  it("sums weight × reps over completed sets", () => {
    const workout = session({
      exercises: [
        {
          id: "e1",
          exerciseId: "bench-press",
          name: "Bench Press",
          sets: [
            { id: "s1", weight: 50, unit: "kg", reps: 5, completed: true },
            { id: "s2", weight: 90, unit: "kg", reps: 3, completed: true },
          ],
        },
        {
          id: "e2",
          exerciseId: "bicep-curl",
          name: "Bicep Curl",
          sets: [
            { id: "s3", weight: 12, unit: "kg", reps: 10, completed: true },
          ],
        },
      ],
    });

    expect(workoutVolume(workout)).toBe(50 * 5 + 90 * 3 + 12 * 10);
  });

  it("ignores incomplete sets", () => {
    const workout = session({
      exercises: [
        {
          id: "e1",
          exerciseId: "bench-press",
          name: "Bench Press",
          sets: [
            { id: "s1", weight: 90, unit: "kg", reps: 3, completed: false },
            { id: "s2", weight: 60, unit: "kg", reps: 8, completed: true },
          ],
        },
      ],
    });

    expect(workoutVolume(workout)).toBe(60 * 8);
  });

  it("treats bodyweight sets without a weight as zero volume", () => {
    const workout = session({
      exercises: [
        {
          id: "e1",
          exerciseId: "push-up",
          name: "Push-up",
          sets: [{ id: "s1", reps: 20, completed: true }],
        },
      ],
    });

    expect(workoutVolume(workout)).toBe(0);
  });

  it("returns 0 for an empty workout", () => {
    expect(workoutVolume(session())).toBe(0);
  });
});

describe("workoutDurationMin", () => {
  it("rounds the elapsed time to whole minutes", () => {
    const workout = session({
      startedAt: "2026-09-10T10:00:00.000Z",
      endedAt: "2026-09-10T10:54:30.000Z",
    });

    expect(workoutDurationMin(workout)).toBe(55);
  });

  it("returns 0 without an end time", () => {
    const workout = session({ endedAt: undefined });

    expect(workoutDurationMin(workout)).toBe(0);
  });

  it("never goes negative for clock drift", () => {
    const workout = session({
      startedAt: "2026-09-10T11:00:00.000Z",
      endedAt: "2026-09-10T10:00:00.000Z",
    });

    expect(workoutDurationMin(workout)).toBe(0);
  });
});

describe("workoutSetCount", () => {
  it("counts logged sets across all exercises", () => {
    const workout = session({
      exercises: [
        {
          id: "e1",
          exerciseId: "bench-press",
          name: "Bench Press",
          sets: [
            { id: "s1", weight: 50, unit: "kg", reps: 5, completed: true },
            { id: "s2", weight: 50, unit: "kg", reps: 5, completed: false },
          ],
        },
        {
          id: "e2",
          exerciseId: "bicep-curl",
          name: "Bicep Curl",
          sets: [{ id: "s3", reps: 10, completed: true }],
        },
      ],
    });

    expect(workoutSetCount(workout)).toBe(3);
  });

  it("returns 0 for an empty workout", () => {
    expect(workoutSetCount(session())).toBe(0);
  });
});

describe("formatDuration", () => {
  it("shows bare minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("collapses exact hours", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("splits hours and minutes", () => {
    expect(formatDuration(94)).toBe("1h 34m");
  });
});

describe("formatVolume", () => {
  it("renders whole numbers under the tonne threshold", () => {
    expect(formatVolume(482)).toBe("482");
  });

  it("compresses thousands to tonnes", () => {
    expect(formatVolume(12500)).toBe("12.5t");
  });
});

describe("formatSetName", () => {
  it("includes the unit", () => {
    expect(formatSetName({ id: "s1", weight: 45.5, unit: "kg", reps: 5, completed: true }))
      .toBe("45.5 kg × 5");
  });

  it("falls back to kg for sets without a unit", () => {
    expect(formatSetName({ id: "s1", weight: 20, reps: 8, completed: true }))
      .toBe("20 kg × 8");
  });

  it("names bodyweight sets by reps only", () => {
    expect(formatSetName({ id: "s1", reps: 15, completed: true }))
      .toBe("15 reps");
  });
});