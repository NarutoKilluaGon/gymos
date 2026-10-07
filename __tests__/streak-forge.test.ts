import { computeStreak } from "@/services/streak";
import type { CardioMap } from "@/types/nourish";
import type {
  CardioEntry,
  DailyActivity,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { addDaysToKey } from "@/utils/date";

/** Fixed local noon, so nothing here depends on when the suite runs. */
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const TODAY = "2026-06-15";
const at = (offset: number) => addDaysToKey(TODAY, -offset);

const set = (extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: "set",
  reps: 5,
  weight: 60,
  completed: true,
  ...extra,
});

const session = (
  date: string,
  extra: Partial<WorkoutSession> = {},
): WorkoutSession => ({
  id: `s-${date}`,
  name: "Upper",
  date,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  exercises: [
    { id: "e1", exerciseId: "bench", name: "Bench", sets: [set()] },
  ],
  ...extra,
});

const day = (
  date: string,
  workouts: WorkoutSession[] = [],
): DailyActivity => ({
  date,
  water: [],
  workouts,
  meals: [],
  sleep: [],
  measurements: [],
  journal: [],
});

const run = (
  workouts: Record<string, WorkoutSession[]>,
  cardio: CardioMap = {},
  now: Date = NOW,
) =>
  computeStreak(
    Object.fromEntries(
      Object.entries(workouts).map(([date, list]) => [date, day(date, list)]),
    ),
    new Set(),
    cardio,
    now,
  );

const cardioLog = (id = "c1") => ({
  id,
  name: "Run",
  detail: "5 km",
  minutes: 30,
  kcal: 300,
  loggedAt: `${TODAY}T08:00:00.000Z`,
});

describe("streak: which Forge workouts count", () => {
  it("counts a finished workout with a completed work set", () => {
    expect(run({ [TODAY]: [session(TODAY)] })).toEqual({
      days: 1,
      todayActive: true,
    });
  });

  it("does not count a started-but-unfinished workout", () => {
    const open = session(TODAY);

    delete open.endedAt;

    expect(run({ [TODAY]: [open] })).toEqual({ days: 0, todayActive: false });
  });

  it("does not count a finished workout with no exercises", () => {
    expect(run({ [TODAY]: [session(TODAY, { exercises: [] })] })).toEqual({
      days: 0,
      todayActive: false,
    });
  });

  it("does not count a finished workout whose sets were never completed", () => {
    const untouched = session(TODAY, {
      exercises: [
        {
          id: "e1",
          exerciseId: "bench",
          name: "Bench",
          sets: [set({ completed: false }), set({ completed: false })],
        },
      ],
    });

    expect(run({ [TODAY]: [untouched] }).todayActive).toBe(false);
  });

  it("does not count a workout with only completed warm-up sets", () => {
    const warmups = session(TODAY, {
      exercises: [
        {
          id: "e1",
          exerciseId: "bench",
          name: "Bench",
          sets: [set({ warmup: true })],
        },
      ],
    });

    expect(run({ [TODAY]: [warmups] }).todayActive).toBe(false);
  });

  it("counts the day when any one of several sessions is completed", () => {
    const open = session(TODAY, { id: "open", exercises: [] });
    const done = session(TODAY, { id: "done" });

    delete open.endedAt;

    expect(run({ [TODAY]: [open, done] }).todayActive).toBe(true);
  });

  it("an empty day inside a run still breaks it", () => {
    const empty = session(at(1), { exercises: [] });

    expect(
      run({
        [TODAY]: [session(TODAY)],
        [at(1)]: [empty],
        [at(2)]: [session(at(2))],
      }),
    ).toEqual({ days: 1, todayActive: true });
  });

  it("survives malformed session records without throwing", () => {
    const broken = [
      null,
      { id: "x", endedAt: "2026-06-15T10:00:00.000Z" },
      { id: "y", endedAt: "2026-06-15T10:00:00.000Z", exercises: [{}] },
    ] as unknown as WorkoutSession[];

    expect(run({ [TODAY]: broken }).todayActive).toBe(false);
  });
});

describe("streak: cardio-only days", () => {
  it("counts a day with only a logged Forge cardio entry", () => {
    expect(run({}, { [TODAY]: [cardioLog()] })).toEqual({
      days: 1,
      todayActive: true,
    });
  });

  it("counts a past cardio-only day inside a run", () => {
    expect(
      run(
        { [TODAY]: [session(TODAY)], [at(2)]: [session(at(2))] },
        { [at(1)]: [cardioLog()] },
      ),
    ).toEqual({ days: 3, todayActive: true });
  });

  it("counts a finished session that holds only cardio entries", () => {
    const entry: CardioEntry = {
      id: "c",
      activity: "running",
      durationMin: 30,
      loggedAt: `${TODAY}T10:30:00.000Z`,
    };

    expect(
      run({ [TODAY]: [session(TODAY, { exercises: [], cardio: [entry] })] }),
    ).toEqual({ days: 1, todayActive: true });
  });

  it("does not count a session carrying cardio that was never finished", () => {
    const entry: CardioEntry = {
      id: "c",
      activity: "running",
      durationMin: 30,
      loggedAt: `${TODAY}T10:30:00.000Z`,
    };
    const open = session(TODAY, { exercises: [], cardio: [entry] });

    delete open.endedAt;

    expect(run({ [TODAY]: [open] }).todayActive).toBe(false);
  });

  it("does not count a zero-minute cardio entry on a finished session", () => {
    const entry: CardioEntry = {
      id: "c",
      activity: "running",
      durationMin: 0,
      loggedAt: `${TODAY}T10:30:00.000Z`,
    };

    expect(
      run({ [TODAY]: [session(TODAY, { exercises: [], cardio: [entry] })] })
        .todayActive,
    ).toBe(false);
  });
});

describe("streak: date boundaries", () => {
  const yesterdayOnly = { [at(1)]: [session(at(1))] };

  it("keeps the streak through an empty today until the day ends", () => {
    expect(run(yesterdayOnly, {}, new Date(2026, 5, 15, 23, 59, 59, 999))).toEqual(
      { days: 1, todayActive: false },
    );
  });

  it("drops the streak the moment a whole day has passed with nothing", () => {
    expect(run(yesterdayOnly, {}, new Date(2026, 5, 16, 0, 0, 0, 1))).toEqual({
      days: 0,
      todayActive: false,
    });
  });

  it("judges today by the supplied clock, not stored state", () => {
    const data = { [TODAY]: [session(TODAY)] };

    expect(run(data, {}, new Date(2026, 5, 15, 0, 0, 1)).todayActive).toBe(true);
    expect(run(data, {}, new Date(2026, 5, 16, 0, 0, 1))).toEqual({
      days: 1,
      todayActive: false,
    });
  });

  it("counts across a month boundary", () => {
    const now = new Date(2026, 2, 2, 12, 0, 0);

    expect(
      run(
        {
          "2026-03-02": [session("2026-03-02")],
          "2026-03-01": [session("2026-03-01")],
          "2026-02-28": [session("2026-02-28")],
        },
        {},
        now,
      ),
    ).toEqual({ days: 3, todayActive: true });
  });
});
