import AsyncStorage from "@react-native-async-storage/async-storage";

import { fromKg, sessionVolumeKg } from "@/services/forge/load";
import { getVolumeTrend } from "@/services/insights";
import { getWorkoutHistory, workoutVolume } from "@/services/workout-history";
import { saveSession } from "@/storage/repositories/workout-sessions";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";
import { addDaysToKey, getTodayKey } from "@/utils/date";

const set = (
  weight: number | undefined,
  reps: number,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  id: `s${Math.random()}`,
  reps,
  completed: true,
  ...(weight === undefined ? {} : { weight }),
  ...extra,
});

const ex = (
  exerciseId: string,
  sets: WorkoutSet[],
  extra: Partial<WorkoutExercise> = {},
): WorkoutExercise => ({
  id: `e-${exerciseId}`,
  exerciseId,
  name: exerciseId,
  sets,
  ...extra,
});

const session = (
  id: string,
  date: string,
  exercises: WorkoutExercise[],
  extra: Partial<WorkoutSession> = {},
): WorkoutSession => ({
  id,
  name: id,
  date,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  exercises,
  ...extra,
});

const DAY = getTodayKey();

/** Each case: the session and its volume in kg, worked out by hand. */
const CASES: { name: string; build: () => WorkoutSession; kg: number }[] = [
  {
    name: "plain kg work sets",
    build: () =>
      session("plain", DAY, [ex("bench", [set(50, 5), set(90, 3)])]),
    kg: 50 * 5 + 90 * 3,
  },
  {
    name: "warm-up sets are excluded",
    build: () =>
      session("warm", DAY, [
        ex("squat", [set(40, 10, { warmup: true }), set(100, 5)]),
      ]),
    kg: 500,
  },
  {
    name: "uncompleted sets are excluded",
    build: () =>
      session("undone", DAY, [
        ex("row", [set(60, 8), set(60, 8, { completed: false })]),
      ]),
    kg: 480,
  },
  {
    name: "lb sets are converted to kg",
    build: () =>
      session("lb", DAY, [ex("press", [set(100, 5, { unit: "lb" })])]),
    kg: 100 * 0.45359237 * 5,
  },
  {
    name: "mixed kg and lb in one session",
    build: () =>
      session("mixed", DAY, [
        ex("a", [set(50, 4, { unit: "kg" })]),
        ex("b", [set(110, 3, { unit: "lb" })]),
      ]),
    kg: 50 * 4 + 110 * 0.45359237 * 3,
  },
  {
    name: "bodyweight exercise adds body weight to the extra load",
    build: () =>
      session(
        "bw",
        DAY,
        [ex("pullup", [set(10, 5)], { bodyweight: true })],
        { bodyweightKg: 80 },
      ),
    kg: (80 + 10) * 5,
  },
  {
    name: "bodyweight exercise with no extra load and no body weight on record",
    build: () =>
      session("bw0", DAY, [ex("pushup", [set(undefined, 20)], { bodyweight: true })]),
    kg: 70 * 20,
  },
  {
    name: "assisted bodyweight load never goes negative",
    build: () =>
      session(
        "assist",
        DAY,
        [ex("dip", [set(-200, 5)], { bodyweight: true })],
        { bodyweightKg: 80 },
      ),
    kg: 0,
  },
  {
    name: "a non-bodyweight exercise with no weight adds nothing",
    build: () => session("noweight", DAY, [ex("crunch", [set(undefined, 20)])]),
    kg: 0,
  },
  {
    name: "empty session",
    build: () => session("empty", DAY, []),
    kg: 0,
  },
];

describe("volume: one definition across Forge, History and Insights", () => {
  for (const { name, build, kg } of CASES) {
    it(`Forge and workout-history agree: ${name}`, () => {
      const s = build();

      expect(sessionVolumeKg(s)).toBeCloseTo(kg, 6);
      expect(workoutVolume(s)).toBeCloseTo(kg, 6);
      expect(workoutVolume(s)).toBe(sessionVolumeKg(s));
    });
  }

  it("a lb-logged session reads the same number of lb in Forge as it was logged", () => {
    const s = session("lbdisplay", DAY, [
      ex("press", [set(100, 5, { unit: "lb" }), set(100, 5, { unit: "lb" })]),
    ]);

    // Forge shows fromKg(volumeKg, unit); 2 × 100 lb × 5 reps is 1000 lb.
    expect(fromKg(sessionVolumeKg(s), "lb")).toBeCloseTo(1000, 6);
    expect(fromKg(workoutVolume(s), "lb")).toBeCloseTo(1000, 6);
  });
});

describe("volume: stored sessions agree between History and the Insights trend", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const total = (points: { volume: number }[]) =>
    points.reduce((sum, point) => sum + point.volume, 0);

  it("the weekly trend totals exactly what History reports for the same sessions", async () => {
    const sessions = CASES.map(({ build }, index) => {
      const built = build();
      const date = addDaysToKey(DAY, -index * 3);

      return {
        ...built,
        id: `stored-${index}`,
        date,
        startedAt: `${date}T10:00:00.000Z`,
        endedAt: `${date}T11:00:00.000Z`,
      };
    });

    for (const s of sessions) await saveSession(s);

    const history = await getWorkoutHistory();
    const fromHistory = history.reduce((sum, w) => sum + workoutVolume(w), 0);
    const fromForge = sessions.reduce((sum, s) => sum + sessionVolumeKg(s), 0);
    const trend = await getVolumeTrend(52);

    expect(history.length).toBe(sessions.length);
    expect(fromHistory).toBeCloseTo(fromForge, 6);
    expect(total(trend)).toBeCloseTo(fromForge, 6);
  });

  it("insights counts warm-up sets as zero, like Forge and History", async () => {
    await saveSession(
      session("w", DAY, [ex("squat", [set(40, 10, { warmup: true }), set(100, 5)])]),
    );

    const trend = await getVolumeTrend(4);

    expect(trend[trend.length - 1]?.volume).toBeCloseTo(500, 6);
  });

  it("insights converts lb sets to kg", async () => {
    await saveSession(
      session("l", DAY, [ex("press", [set(100, 5, { unit: "lb" })])]),
    );

    const trend = await getVolumeTrend(4);

    expect(trend[trend.length - 1]?.volume).toBeCloseTo(100 * 0.45359237 * 5, 6);
  });

  it("insights includes bodyweight load the way Forge does", async () => {
    await saveSession(
      session("b", DAY, [ex("pullup", [set(10, 5)], { bodyweight: true })], {
        bodyweightKg: 80,
      }),
    );

    const trend = await getVolumeTrend(4);

    expect(trend[trend.length - 1]?.volume).toBeCloseTo(450, 6);
  });

  it("an unfinished session is in no consumer's volume", async () => {
    const open = session("open", DAY, [ex("bench", [set(100, 10)])]);

    delete open.endedAt;
    await saveSession(open);

    expect(total(await getVolumeTrend(4))).toBe(0);
    expect(await getWorkoutHistory()).toEqual([]);
  });

  it("insights tolerates malformed stored workouts", async () => {
    await AsyncStorage.setItem(
      "@gymos/daily",
      JSON.stringify({
        [DAY]: {
          date: DAY,
          water: [],
          workouts: [
            null,
            { id: "x", endedAt: `${DAY}T11:00:00.000Z` },
            { id: "y", endedAt: `${DAY}T11:00:00.000Z`, exercises: [{ id: "e" }] },
          ],
          meals: [],
          sleep: [],
          measurements: [],
          journal: [],
        },
      }),
    );

    expect(total(await getVolumeTrend(4))).toBe(0);
  });
});
