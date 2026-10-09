import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";
import { AppState, type AppStateStatus } from "react-native";

import HomeScreen from "@/app/index";
import { getDailyMacroTotals } from "@/storage/repositories/meals";
import { saveSession } from "@/storage/repositories/workout-sessions";
import { getTodayWater } from "@/storage/repositories/water";
import type { PlanDay } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));

// Same harness as home-active-workout.test.tsx: everything that is not a
// date-dependent slice is stubbed, sessions use the real repository
// (AsyncStorage's jest mock), and the cards record the props Home gives them.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");

  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    // Re-runs when the callback changes, like the real hook while focused.
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));
jest.mock("@/contexts/modules-context", () => ({
  useModules: () => ({ enabled: { workouts: true, nutrition: true } }),
}));
jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({ unit: "kg", toggle: jest.fn() }),
}));

type DayData = {
  waterMl: number;
  meals: number;
  protein: number;
  steps: number;
  taken: number;
  todayActive: boolean;
};

// 2026-10-04 is a Sunday, 2026-10-05 a Monday, 2026-10-06 a Tuesday.
const mockDays: Record<string, DayData> = {
  "2026-10-04": { waterMl: 1500, meals: 3, protein: 120, steps: 6000, taken: 2, todayActive: true },
  "2026-10-05": { waterMl: 250, meals: 1, protein: 30, steps: 400, taken: 0, todayActive: false },
  "2026-10-06": { waterMl: 750, meals: 2, protein: 60, steps: 900, taken: 1, todayActive: false },
};
const mockEmpty: DayData = { waterMl: 0, meals: 0, protein: 0, steps: 0, taken: 0, todayActive: false };
// Readers resolve "today" from the clock at call time, like the real ones.
const mockToday = (): DayData => {
  const { getTodayKey } = jest.requireActual("@/utils/date");

  return mockDays[getTodayKey() as string] ?? mockEmpty;
};

// Hold the first getTodayWater() call open to simulate a slow load.
const mockGate: { water?: Promise<number> } = {};

const mockUi: {
  workout?: WorkoutSession;
  plannedDay?: PlanDay | null;
  targets?: {
    water: number;
    mealsLogged: number;
    protein: number;
    steps: number;
    supplementsTaken: number;
  };
  todayActive?: boolean;
} = {};

jest.mock("@/components/dashboard/workout-card", () => ({
  WorkoutCard: (props: { workout?: WorkoutSession; plannedDay?: PlanDay | null }) => {
    mockUi.workout = props.workout;
    mockUi.plannedDay = props.plannedDay;

    return null;
  },
}));
jest.mock("@/components/dashboard/daily-targets-card", () => ({
  DailyTargetsCard: (props: NonNullable<typeof mockUi.targets>) => {
    mockUi.targets = props;

    return null;
  },
}));
jest.mock("@/components/dashboard/streak-card", () => ({
  StreakCard: (props: { todayActive: boolean }) => {
    mockUi.todayActive = props.todayActive;

    return null;
  },
}));
jest.mock("@/components/ui/fade-in", () => ({
  FadeIn: (props: { children: unknown }) => props.children,
}));
jest.mock("@/components/dashboard/supplement-log-sheet", () => ({ SupplementLogSheet: () => null }));
jest.mock("@/components/dashboard/greeting", () => ({ Greeting: () => null }));
jest.mock("@/components/dashboard/north-star-card", () => ({ NorthStarCard: () => null }));
jest.mock("@/components/dashboard/north-star-setup-card", () => ({ NorthStarSetupCard: () => null }));
jest.mock("@/components/fab/gym-fab", () => ({ GymFAB: () => null }));

jest.mock("@/storage/repositories/journal", () => ({ addJournalEntry: jest.fn() }));
jest.mock("@/storage/repositories/measurements", () => ({ addMeasurement: jest.fn() }));
jest.mock("@/storage/repositories/meals", () => ({
  getDailyMacroTotals: jest.fn(async (dateKey: string) => ({
    protein: mockDays[dateKey]?.protein ?? 0,
  })),
  getTodayMeals: jest.fn(async () =>
    Array.from({ length: mockToday().meals }, (_, index) => ({ id: String(index) })),
  ),
}));
jest.mock("@/storage/repositories/north-star", () => ({ getNorthStar: jest.fn(async () => null) }));
jest.mock("@/storage/repositories/nourish-settings", () => ({
  getNourishSettings: jest.fn(async () => ({ protein: 150 })),
}));
jest.mock("@/storage/repositories/forge-settings", () => ({
  // Weekly schedule: Sunday = Push, Monday = Pull, other days are rest.
  getForgeSettings: jest.fn(async () => ({
    plans: [
      {
        id: "plan",
        name: "Plan",
        rotate: false,
        deload: false,
        updatedAt: "2026-10-01T00:00:00.000Z",
        days: [
          { id: "push", name: "Push", exercises: [] },
          { id: "pull", name: "Pull", exercises: [] },
        ],
        schedule: { "0": "push", "1": "pull" },
      },
    ],
    activePlanId: "plan",
    restSeconds: 90,
    barKg: 20,
    routinesImported: true,
  })),
}));
jest.mock("@/storage/repositories/supplement-logs", () => ({
  getEnabledSupplementProgress: jest.fn(async () => ({ total: 2, taken: mockToday().taken })),
}));
jest.mock("@/storage/repositories/sleep", () => ({
  deleteSleepSession: jest.fn(),
  getTodaySleep: jest.fn(async () => []),
  logSleepDuration: jest.fn(),
}));
jest.mock("@/storage/repositories/steps", () => ({
  getTodaySteps: jest.fn(async () => mockToday().steps),
}));
jest.mock("@/storage/repositories/water", () => ({
  addWater: jest.fn(),
  getTodayWater: jest.fn(async () => {
    const gate = mockGate.water;

    if (gate) {
      mockGate.water = undefined;

      return gate;
    }

    return mockToday().waterMl;
  }),
}));
jest.mock("@/services/progress-photos", () => ({ pickAndSavePhotoFromLibrary: jest.fn() }));
jest.mock("@/services/streak", () => ({
  getStreak: jest.fn(async () => ({ days: 3, todayActive: mockToday().todayActive })),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => void | Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BEFORE_MIDNIGHT = new Date(2026, 9, 4, 23, 59, 30);
const AFTER_MIDNIGHT = new Date(2026, 9, 5, 0, 0, 10);

let appStateHandler: ((state: AppStateStatus) => void) | undefined;
let appStateSpy: jest.SpyInstance | undefined;
let mounted: { unmount: () => void } | undefined;

const waterCalls = () => (getTodayWater as jest.Mock).mock.calls.length;

/** Advance the fake clock and let every pending read settle. */
const tick = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  }) as Promise<void>;

/** Let in-flight loads finish without moving time. */
const settle = () => tick(0);

/** Move the wall clock without firing timers or re-rendering. */
const jumpClock = (to: Date) => jest.setSystemTime(to);

async function mountHome() {
  await act(async () => {
    mounted = TestRenderer.create(createElement(HomeScreen));
  });
  await settle();
}

const session = (id: string, date: string, startedAt: Date, endedAt?: Date): WorkoutSession => ({
  id,
  name: id,
  startedAt: startedAt.toISOString(),
  ...(endedAt ? { endedAt: endedAt.toISOString() } : {}),
  date,
  exercises: [],
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(BEFORE_MIDNIGHT);
  mockUi.workout = undefined;
  mockUi.plannedDay = undefined;
  mockUi.targets = undefined;
  mockUi.todayActive = undefined;
  mockGate.water = undefined;
  appStateHandler = undefined;
  appStateSpy = jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    handler: (s: AppStateStatus) => void,
  ) => {
    appStateHandler = handler;

    return { remove: jest.fn() };
  }) as never);
});

afterEach(async () => {
  await act(async () => mounted?.unmount());
  mounted = undefined;
  jest.useRealTimers();
  appStateSpy?.mockRestore();
});

describe("Home reloads its date-dependent data across the day boundary", () => {
  it("loads yesterday's data before midnight and reloads every slice after the timer rolls over", async () => {
    await mountHome();

    expect(waterCalls()).toBe(1);
    expect(mockUi.targets).toMatchObject({
      water: 1.5,
      mealsLogged: 3,
      protein: 120,
      steps: 6000,
      supplementsTaken: 2,
    });
    expect(mockUi.todayActive).toBe(true);
    expect(getDailyMacroTotals).toHaveBeenLastCalledWith("2026-10-04");

    await tick(31_000); // past midnight
    await settle();

    expect(waterCalls()).toBe(2);
    expect(mockUi.targets).toMatchObject({
      water: 0.25,
      mealsLogged: 1,
      protein: 30,
      steps: 400,
      supplementsTaken: 0,
    });
    expect(mockUi.todayActive).toBe(false);
    expect(getDailyMacroTotals).toHaveBeenLastCalledWith("2026-10-05");
  });

  it("the weekly schedule moves the planned workout to the new day", async () => {
    await mountHome();
    expect(mockUi.plannedDay?.name).toBe("Push"); // Sunday

    await tick(31_000);
    await settle();
    expect(mockUi.plannedDay?.name).toBe("Pull"); // Monday

    await tick(24 * 3_600_000); // Tuesday has no scheduled day
    await settle();
    expect(mockUi.plannedDay).toBeNull();
  });

  it("returning to the foreground after a clock jump reloads Home", async () => {
    await mountHome();
    expect(waterCalls()).toBe(1);

    jumpClock(AFTER_MIDNIGHT); // no timer fired, nothing re-rendered
    await act(async () => appStateHandler?.("active"));
    await settle();

    expect(waterCalls()).toBe(2);
    expect(mockUi.targets).toMatchObject({ water: 0.25, mealsLogged: 1 });
    expect(mockUi.plannedDay?.name).toBe("Pull");
  });

  it("returning to the foreground on the same day does not reload", async () => {
    await mountHome();

    await act(async () => appStateHandler?.("active"));
    await settle();
    await act(async () => appStateHandler?.("active"));
    await settle();

    expect(waterCalls()).toBe(1);
  });

  it("does not reload before midnight", async () => {
    await mountHome();

    await tick(10_000);
    await settle();

    expect(waterCalls()).toBe(1);
    expect(mockUi.targets).toMatchObject({ water: 1.5 });
  });

  it("keeps a previous-day unfinished session active across midnight and picks up a new one on reload", async () => {
    await saveSession(session("old", "2026-10-04", new Date(2026, 9, 4, 20, 0)));
    await mountHome();
    expect(mockUi.workout?.id).toBe("old");

    await tick(31_000);
    await settle();
    expect(mockUi.workout?.id).toBe("old"); // B1: unfinished on any day stays active

    await saveSession(session("fresh", "2026-10-05", new Date(2026, 9, 5, 0, 1)));
    await tick(24 * 3_600_000); // the next rollover reloads Home
    await settle();
    expect(mockUi.workout?.id).toBe("fresh");
  });

  it("a slow pre-midnight load cannot overwrite the newer rollover load", async () => {
    let release: (ml: number) => void = () => undefined;

    mockGate.water = new Promise<number>((resolve) => {
      release = resolve;
    });

    await mountHome(); // load #1 is stuck waiting on water
    expect(mockUi.targets).toMatchObject({ water: 0, mealsLogged: 0 }); // still the defaults

    await tick(31_000); // rollover starts load #2, which completes
    await settle();
    expect(mockUi.targets).toMatchObject({ water: 0.25, mealsLogged: 1 });

    await act(async () => release(1500)); // yesterday's water arrives late
    await settle();

    expect(mockUi.targets).toMatchObject({ water: 0.25, mealsLogged: 1, protein: 30 });
    expect(mockUi.plannedDay?.name).toBe("Pull");
  });

  it("stops reloading after Home unmounts", async () => {
    await mountHome();
    expect(waterCalls()).toBe(1);

    await act(async () => mounted?.unmount());
    mounted = undefined;

    await tick(31_000);
    await settle();

    expect(waterCalls()).toBe(1);
  });
});
