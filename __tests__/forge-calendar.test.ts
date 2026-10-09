import {
  buildCalendarSummaryMap,
  getMonthGrid,
  getMonthStats,
} from "@/services/forge/calendar";
import type { CardioLog } from "@/types/nourish";
import type { WorkoutSession, WorkoutSet } from "@/types/gymos";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const makeSet = (overrides?: Partial<WorkoutSet>): WorkoutSet => ({
  id: "s1",
  weight: 50,
  reps: 10,
  completed: true,
  warmup: false,
  ...overrides,
});

const makeSession = (
  id: string,
  dateKey: string,
  overrides?: Partial<WorkoutSession>,
): WorkoutSession => ({
  id,
  name: `Workout ${id}`,
  startedAt: `${dateKey}T10:00:00.000Z`,
  endedAt: `${dateKey}T11:00:00.000Z`,
  date: dateKey,
  exercises: [
    {
      id: "e1",
      exerciseId: "ex1",
      name: "Bench Press",
      sets: [makeSet()],
    },
  ],
  ...overrides,
});

const makeCardioLog = (
  id: string,
  overrides?: Partial<CardioLog>,
): CardioLog => ({
  id,
  name: "Running",
  detail: "30 min run",
  minutes: 30,
  kcal: 300,
  loggedAt: new Date().toISOString(),
  ...overrides,
});

/* ------------------------------------------------------------------ */
/*  buildCalendarSummaryMap                                            */
/* ------------------------------------------------------------------ */
describe("buildCalendarSummaryMap", () => {
  it("aggregates completed sessions by day key", () => {
    const sessions = [
      makeSession("w1", "2026-10-01"),
      makeSession("w2", "2026-10-01"),
      makeSession("w3", "2026-10-03"),
    ];
    const map = buildCalendarSummaryMap(sessions, {});

    expect(map.get("2026-10-01")?.sessions).toHaveLength(2);
    expect(map.get("2026-10-01")?.hasStrength).toBe(true);
    expect(map.get("2026-10-01")?.hasCardio).toBe(false);
    expect(map.get("2026-10-03")?.sessions).toHaveLength(1);
    expect(map.has("2026-10-02")).toBe(false);
  });

  it("aggregates cardio logs by day key", () => {
    const cardioMap = {
      "2026-10-05": [makeCardioLog("c1"), makeCardioLog("c2")],
      "2026-10-06": [makeCardioLog("c3")],
    };
    const map = buildCalendarSummaryMap([], cardioMap);

    expect(map.get("2026-10-05")?.hasCardio).toBe(true);
    expect(map.get("2026-10-05")?.cardio).toHaveLength(2);
    expect(map.get("2026-10-05")?.hasStrength).toBe(false);
    expect(map.get("2026-10-06")?.cardio).toHaveLength(1);
  });

  it("merges strength and cardio on the same day", () => {
    const sessions = [makeSession("w1", "2026-10-01")];
    const cardioMap = { "2026-10-01": [makeCardioLog("c1")] };
    const map = buildCalendarSummaryMap(sessions, cardioMap);

    const summary = map.get("2026-10-01");
    expect(summary?.hasStrength).toBe(true);
    expect(summary?.hasCardio).toBe(true);
    expect(summary?.sessions).toHaveLength(1);
    expect(summary?.cardio).toHaveLength(1);
  });

  it("ignores sessions without endedAt (not completed)", () => {
    const sessions = [
      makeSession("w1", "2026-10-01", { endedAt: undefined }),
    ];
    const map = buildCalendarSummaryMap(sessions, {});

    expect(map.size).toBe(0);
  });

  it("ignores sessions with no work sets (warm-ups only)", () => {
    const sessions = [
      makeSession("w1", "2026-10-01", {
        exercises: [
          {
            id: "e1",
            exerciseId: "ex1",
            name: "Bench Press",
            sets: [makeSet({ warmup: true, completed: true })],
          },
        ],
      }),
    ];
    const map = buildCalendarSummaryMap(sessions, {});

    // completedSessions filters these out
    expect(map.size).toBe(0);
  });

  it("handles empty input gracefully", () => {
    const map = buildCalendarSummaryMap([], {});
    expect(map.size).toBe(0);
  });

  it("skips empty cardio arrays", () => {
    const cardioMap = { "2026-10-01": [] as CardioLog[] };
    const map = buildCalendarSummaryMap([], cardioMap);
    expect(map.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  getMonthGrid                                                       */
/* ------------------------------------------------------------------ */
describe("getMonthGrid", () => {
  const summaryMap = buildCalendarSummaryMap(
    [makeSession("w1", "2026-10-08")],
    { "2026-10-15": [makeCardioLog("c1")] },
  );

  it("generates a Monday-first grid", () => {
    const grid = getMonthGrid(2026, 9, summaryMap, "2026-10-09");
    // October 2026: 1st is a Thursday. Monday-first means padding from
    // Mon 28 Sep through Wed 30 Sep.
    expect(grid.length % 7).toBe(0);

    // First cell should be a Monday (check by seeing if it's a previous-month day)
    const first = grid[0]!;
    expect(first.isCurrentMonth).toBe(false);
    // Thursday = 3rd cell in a Mon-first week (Mon=0, Tue=1, Wed=2, Thu=3)
    const oct1 = grid.find((c) => c.isCurrentMonth && c.dayNumber === 1);
    expect(oct1).toBeDefined();
    // Oct 1 2026 is Thursday, so its index in the row should be 3
    const oct1Index = grid.indexOf(oct1!);
    expect(oct1Index % 7).toBe(3); // Thu in Mon-first = index 3
  });

  it("marks today correctly", () => {
    const grid = getMonthGrid(2026, 9, summaryMap, "2026-10-09");
    const todayCell = grid.find((c) => c.isToday);
    expect(todayCell).toBeDefined();
    expect(todayCell!.dayNumber).toBe(9);
    expect(todayCell!.isCurrentMonth).toBe(true);
  });

  it("does not mark today when viewing another month", () => {
    const grid = getMonthGrid(2026, 8, summaryMap, "2026-10-09"); // September
    const todayCells = grid.filter((c) => c.isToday);
    // The September grid may include Oct 9 in padding, but October 9 is
    // far from Sep, so it shouldn't appear. No cell should be today.
    expect(todayCells.length).toBe(0);
  });

  it("populates strength and cardio flags from summaryMap", () => {
    const grid = getMonthGrid(2026, 9, summaryMap, "2026-10-09");
    const oct8 = grid.find(
      (c) => c.isCurrentMonth && c.dayNumber === 8,
    );
    expect(oct8?.hasStrength).toBe(true);
    expect(oct8?.hasCardio).toBe(false);

    const oct15 = grid.find(
      (c) => c.isCurrentMonth && c.dayNumber === 15,
    );
    expect(oct15?.hasStrength).toBe(false);
    expect(oct15?.hasCardio).toBe(true);
  });

  it("pads to fill complete rows of 7", () => {
    const grid = getMonthGrid(2026, 9, summaryMap, "2026-10-09");
    expect(grid.length % 7).toBe(0);
    // October has 31 days. With Thursday start (3 padding before), total cells
    // = 3 + 31 = 34, padded to 35 (5 rows). Let's verify.
    expect(grid.length).toBeGreaterThanOrEqual(35);
  });
});

/* ------------------------------------------------------------------ */
/*  getMonthStats                                                      */
/* ------------------------------------------------------------------ */
describe("getMonthStats", () => {
  it("counts workouts and cardio in a month", () => {
    const summaryMap = buildCalendarSummaryMap(
      [
        makeSession("w1", "2026-10-01"),
        makeSession("w2", "2026-10-05"),
        makeSession("w3", "2026-10-05"),
      ],
      {
        "2026-10-03": [makeCardioLog("c1")],
        "2026-10-07": [makeCardioLog("c2"), makeCardioLog("c3")],
      },
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    // 2 unique days with workouts (Oct 1 and Oct 5), not 3 sessions
    expect(stats.workoutsThisMonth).toBe(2);
    // 2 unique days with cardio (Oct 3 and Oct 7)
    expect(stats.cardioThisMonth).toBe(2);
  });

  it("returns zero for an empty month", () => {
    const emptyMap = buildCalendarSummaryMap([], {});
    const stats = getMonthStats(2026, 9, emptyMap);

    expect(stats.workoutsThisMonth).toBe(0);
    expect(stats.cardioThisMonth).toBe(0);
    expect(stats.activeStreakDays).toBe(0);
  });

  it("does not count sessions from other months", () => {
    const summaryMap = buildCalendarSummaryMap(
      [
        makeSession("w1", "2026-09-30"),
        makeSession("w2", "2026-11-01"),
      ],
      {},
    );

    const stats = getMonthStats(2026, 9, summaryMap); // October
    expect(stats.workoutsThisMonth).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Streak computation (via getMonthStats)                             */
/* ------------------------------------------------------------------ */
describe("streak computation", () => {
  // We freeze "today" by mocking Date to a known day
  const RealDate = globalThis.Date;

  afterEach(() => {
    globalThis.Date = RealDate;
  });

  function mockToday(isoDate: string) {
    const fakeNow = new RealDate(isoDate).getTime();
    // @ts-expect-error -- partial mock of Date constructor
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fakeNow);
        } else {
          super(...(args as [string | number]));
        }
      }

      static now() {
        return fakeNow;
      }
    };
  }

  it("computes a streak of consecutive days ending at today", () => {
    mockToday("2026-10-09T12:00:00.000Z");
    const summaryMap = buildCalendarSummaryMap(
      [
        makeSession("w1", "2026-10-07"),
        makeSession("w2", "2026-10-08"),
        makeSession("w3", "2026-10-09"),
      ],
      {},
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    expect(stats.activeStreakDays).toBe(3);
  });

  it("streak falls back to yesterday if today has no activity", () => {
    mockToday("2026-10-09T12:00:00.000Z");
    const summaryMap = buildCalendarSummaryMap(
      [
        makeSession("w1", "2026-10-07"),
        makeSession("w2", "2026-10-08"),
        // No session on Oct 9 (today)
      ],
      {},
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    expect(stats.activeStreakDays).toBe(2);
  });

  it("streak breaks on a gap day", () => {
    mockToday("2026-10-09T12:00:00.000Z");
    const summaryMap = buildCalendarSummaryMap(
      [
        makeSession("w1", "2026-10-06"),
        // Oct 7 gap
        makeSession("w2", "2026-10-08"),
        makeSession("w3", "2026-10-09"),
      ],
      {},
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    expect(stats.activeStreakDays).toBe(2); // Oct 8 + Oct 9
  });

  it("cardio-only days count toward the streak", () => {
    mockToday("2026-10-09T12:00:00.000Z");
    const summaryMap = buildCalendarSummaryMap(
      [makeSession("w1", "2026-10-08")],
      { "2026-10-09": [makeCardioLog("c1")] },
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    expect(stats.activeStreakDays).toBe(2); // Oct 8 strength + Oct 9 cardio
  });

  it("streak is zero when no recent activity", () => {
    mockToday("2026-10-09T12:00:00.000Z");
    const summaryMap = buildCalendarSummaryMap(
      [makeSession("w1", "2026-10-01")],
      {},
    );

    const stats = getMonthStats(2026, 9, summaryMap);
    expect(stats.activeStreakDays).toBe(0);
  });
});
