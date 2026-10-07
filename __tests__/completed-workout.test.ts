import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  completedSessions,
  finishedSessions,
  isCompletedWorkout,
  sessionsInLast,
} from "@/services/forge/history";
import { historyGrid } from "@/services/forge/grid";
import {
  getHeatmap,
  getMonthlySummaries,
  getWeekInsights,
} from "@/services/insights";
import { computeStreak } from "@/services/streak";
import { getTimeline } from "@/services/timeline";
import { getWorkoutHistory } from "@/services/workout-history";
import { saveSession } from "@/storage/repositories/workout-sessions";
import type {
  CardioEntry,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { addDaysToKey, getTodayKey } from "@/utils/date";

const TODAY = getTodayKey();

const set = (extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: "set",
  reps: 5,
  weight: 60,
  completed: true,
  ...extra,
});

const exercise = (sets: WorkoutSet[]): WorkoutExercise => ({
  id: "e1",
  exerciseId: "bench",
  name: "Bench",
  sets,
});

const cardio = (durationMin: number): CardioEntry => ({
  id: "c1",
  activity: "running",
  durationMin,
  loggedAt: "2026-06-15T10:30:00.000Z",
});

/** Local times so the session lands on `date` in any time zone. */
const session = (
  id: string,
  date: string,
  extra: Partial<WorkoutSession> = {},
): WorkoutSession => {
  const [y, m, d] = date.split("-").map(Number);

  return {
    id,
    name: id,
    date,
    startedAt: new Date(y!, m! - 1, d!, 18, 0, 0).toISOString(),
    endedAt: new Date(y!, m! - 1, d!, 19, 0, 0).toISOString(),
    durationMs: 3_600_000,
    exercises: [exercise([set()])],
    ...extra,
  };
};

// One fixture per case the audit cares about.
const withWork = (id: string, date = TODAY) => session(id, date);
const zeroWork = (id: string, date = TODAY) =>
  session(id, date, { exercises: [exercise([set({ completed: false })])] });
const noExercises = (id: string, date = TODAY) =>
  session(id, date, { exercises: [] });
const warmupOnly = (id: string, date = TODAY) =>
  session(id, date, {
    exercises: [exercise([set({ warmup: true }), set({ warmup: true })])],
  });
const unfinished = (id: string, date = TODAY) =>
  session(id, date, { endedAt: undefined });
const cardioOnly = (id: string, date = TODAY) =>
  session(id, date, { exercises: [], cardio: [cardio(30)] });

const ids = (list: readonly WorkoutSession[]) => list.map((s) => s.id).sort();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("isCompletedWorkout", () => {
  it("counts a finished session with a completed work set", () => {
    expect(isCompletedWorkout(withWork("a"))).toBe(true);
  });

  it("does not count a finished session with zero completed work", () => {
    expect(isCompletedWorkout(zeroWork("a"))).toBe(false);
    expect(isCompletedWorkout(noExercises("b"))).toBe(false);
  });

  it("does not count an unfinished session, even with completed work", () => {
    expect(isCompletedWorkout(unfinished("a"))).toBe(false);
  });

  it("does not count a warm-up-only session", () => {
    expect(isCompletedWorkout(warmupOnly("a"))).toBe(false);
  });

  it("counts a warm-up plus one real completed set", () => {
    const mixed = session("a", TODAY, {
      exercises: [exercise([set({ warmup: true }), set()])],
    });

    expect(isCompletedWorkout(mixed)).toBe(true);
  });

  it("keeps the existing cardio semantics (positive duration counts)", () => {
    expect(isCompletedWorkout(cardioOnly("a"))).toBe(true);
    expect(
      isCompletedWorkout(
        session("b", TODAY, { exercises: [], cardio: [cardio(0)] }),
      ),
    ).toBe(false);
    // Cardio never rescues an unfinished session.
    expect(
      isCompletedWorkout(
        session("c", TODAY, {
          exercises: [],
          cardio: [cardio(30)],
          endedAt: undefined,
        }),
      ),
    ).toBe(false);
  });

  it("reads malformed records as not completed instead of throwing", () => {
    expect(isCompletedWorkout(undefined)).toBe(false);
    expect(
      isCompletedWorkout({
        ...withWork("a"),
        exercises: undefined,
      } as unknown as WorkoutSession),
    ).toBe(false);
  });
});

describe("completedSessions / sessionsInLast", () => {
  const all = [
    withWork("work"),
    zeroWork("zero"),
    warmupOnly("warm"),
    unfinished("open"),
    cardioOnly("cardio"),
  ];

  it("keeps only completed workouts; finishedSessions stays lifecycle-only", () => {
    expect(ids(completedSessions(all))).toEqual(["cardio", "work"]);
    // Lifecycle view (used for PR derivation) is deliberately unchanged.
    expect(ids(finishedSessions(all))).toEqual([
      "cardio",
      "warm",
      "work",
      "zero",
    ]);
  });

  it("sessionsInLast counts completed workouts only", () => {
    expect(ids(sessionsInLast(all, 7, new Date()))).toEqual([
      "cardio",
      "work",
    ]);
  });

  it("the history grid has no column for a session with nothing done", () => {
    const grid = historyGrid(all, "kg", 8);

    expect(ids(grid.columns.map((column) => column.session))).toEqual([
      "cardio",
      "work",
    ]);
  });
});

describe("streak agrees with the shared predicate", () => {
  const now = new Date(`${TODAY}T12:00:00`);
  const activity = (workouts: WorkoutSession[]) => ({
    [TODAY]: {
      date: TODAY,
      water: [],
      workouts,
      meals: [],
      sleep: [],
      measurements: [],
      journal: [],
    },
  });

  const cases: { label: string; workouts: WorkoutSession[]; days: number }[] = [
    { label: "completed work", workouts: [withWork("a")], days: 1 },
    { label: "zero completed work", workouts: [zeroWork("a")], days: 0 },
    { label: "unfinished", workouts: [unfinished("a")], days: 0 },
    { label: "warm-up only", workouts: [warmupOnly("a")], days: 0 },
    { label: "meaningful cardio", workouts: [cardioOnly("a")], days: 1 },
  ];

  for (const { label, workouts, days } of cases) {
    it(`${label} -> streak ${days}`, () => {
      expect(
        computeStreak(activity(workouts), new Set(), {}, now).days,
      ).toBe(days);
    });
  }
});

describe("Insights count completed workouts only", () => {
  beforeEach(async () => {
    await saveSession(withWork("work"));
    await saveSession(zeroWork("zero"));
    await saveSession(noExercises("empty"));
    await saveSession(warmupOnly("warm"));
    await saveSession(unfinished("open"));
    await saveSession(cardioOnly("cardio"));
  });

  it("heatmap cell for the day counts completed work + meaningful cardio", async () => {
    const cells = (await getHeatmap(2)).flatMap((week) => week.cells);

    expect(cells.find((cell) => cell.date === TODAY)?.count).toBe(2);
  });

  it("weekly stats count completed workouts and trained days", async () => {
    const { current } = await getWeekInsights();

    expect(current.workouts).toBe(2);
    expect(current.workoutDays).toBe(1);
  });

  it("monthly summary counts completed workouts", async () => {
    const [month] = (await getMonthlySummaries(1)).slice(-1);

    expect(month?.workouts).toBe(2);
    expect(month?.workoutDays).toBe(1);
  });

  it("a day with only non-completed sessions is not a workout day", async () => {
    await AsyncStorage.clear();
    await saveSession(zeroWork("zero"));
    await saveSession(warmupOnly("warm"));
    await saveSession(unfinished("open"));

    const cells = (await getHeatmap(2)).flatMap((week) => week.cells);
    const { current } = await getWeekInsights();

    expect(cells.find((cell) => cell.date === TODAY)?.count).toBe(0);
    expect(current.workouts).toBe(0);
    expect(current.workoutDays).toBe(0);
  });
});

describe("History and Timeline list completed workouts only", () => {
  const yesterday = addDaysToKey(TODAY, -1);

  beforeEach(async () => {
    await saveSession(withWork("work", yesterday));
    await saveSession(zeroWork("zero", yesterday));
    await saveSession(warmupOnly("warm", yesterday));
    await saveSession(unfinished("open", yesterday));
    await saveSession(cardioOnly("cardio", yesterday));
  });

  it("workout history returns completed workouts only", async () => {
    expect(ids(await getWorkoutHistory())).toEqual(["cardio", "work"]);
  });

  it("the timeline has no entry for a finished session with nothing done", async () => {
    const names = (await getTimeline())
      .filter((item) => item.kind === "workout")
      .map((item) => (item.kind === "workout" ? item.name : ""))
      .sort();

    expect(names).toEqual(["cardio", "work"]);
  });
});
