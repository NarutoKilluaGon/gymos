import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import HomeScreen from "@/app/index";
import {
  getActiveSession,
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";
import { addDaysToKey, getTodayKey } from "@/utils/date";

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));

// Home pulls in a lot besides the workout card. Everything that is not part
// of "which workout is active" is stubbed; sessions use the real repository
// (AsyncStorage's jest mock) so the bucketing under test is the real one.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");

  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});
jest.mock("@/utils/toast", () => ({ showToast: jest.fn() }));
jest.mock("@/contexts/modules-context", () => ({
  useModules: () => ({ enabled: { workouts: true, nutrition: true } }),
}));
jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({ unit: "kg", toggle: jest.fn() }),
}));

const mockCard: { workout?: WorkoutSession; renders: number } = { renders: 0 };

jest.mock("@/components/dashboard/workout-card", () => ({
  WorkoutCard: (props: { workout?: WorkoutSession }) => {
    mockCard.workout = props.workout;
    mockCard.renders += 1;

    return null;
  },
}));
jest.mock("@/components/ui/fade-in", () => ({
  FadeIn: (props: { children: unknown }) => props.children,
}));
jest.mock("@/components/dashboard/daily-targets-card", () => ({ DailyTargetsCard: () => null }));
jest.mock("@/components/dashboard/supplement-log-sheet", () => ({ SupplementLogSheet: () => null }));
jest.mock("@/components/dashboard/greeting", () => ({ Greeting: () => null }));
jest.mock("@/components/dashboard/north-star-card", () => ({ NorthStarCard: () => null }));
jest.mock("@/components/dashboard/streak-card", () => ({ StreakCard: () => null }));
jest.mock("@/components/dashboard/north-star-setup-card", () => ({ NorthStarSetupCard: () => null }));
jest.mock("@/components/fab/gym-fab", () => ({ GymFAB: () => null }));

jest.mock("@/storage/repositories/journal", () => ({ addJournalEntry: jest.fn() }));
jest.mock("@/storage/repositories/measurements", () => ({ addMeasurement: jest.fn() }));
jest.mock("@/storage/repositories/meals", () => ({
  getDailyMacroTotals: jest.fn(async () => ({ protein: 0 })),
  getTodayMeals: jest.fn(async () => []),
}));
jest.mock("@/storage/repositories/north-star", () => ({ getNorthStar: jest.fn(async () => null) }));
jest.mock("@/storage/repositories/nourish-settings", () => ({
  getNourishSettings: jest.fn(async () => ({ protein: 150 })),
}));
jest.mock("@/storage/repositories/forge-settings", () => ({
  getForgeSettings: jest.fn(async () => ({
    plans: [],
    activePlanId: "",
    restSeconds: 90,
    barKg: 20,
    routinesImported: true,
  })),
}));
jest.mock("@/storage/repositories/supplement-logs", () => ({
  getEnabledSupplementProgress: jest.fn(async () => ({ total: 0, taken: 0 })),
}));
jest.mock("@/storage/repositories/sleep", () => ({
  deleteSleepSession: jest.fn(),
  getTodaySleep: jest.fn(async () => []),
  logSleepDuration: jest.fn(),
}));
jest.mock("@/storage/repositories/steps", () => ({ getTodaySteps: jest.fn(async () => 0) }));
jest.mock("@/storage/repositories/water", () => ({
  addWater: jest.fn(),
  getTodayWater: jest.fn(async () => 0),
}));
jest.mock("@/services/progress-photos", () => ({ pickAndSavePhotoFromLibrary: jest.fn() }));
jest.mock("@/services/streak", () => ({
  getStreak: jest.fn(async () => ({ days: 0, todayActive: false })),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = getTodayKey();
const yesterday = addDaysToKey(today, -1);

const session = (
  id: string,
  date: string,
  startedAt: string,
  endedAt?: string,
): WorkoutSession => ({
  id,
  name: id,
  startedAt,
  ...(endedAt ? { endedAt } : {}),
  date,
  exercises: [],
});

/** Mount Home and let its focus load (a chain of awaited reads) settle. */
async function renderHome() {
  let renderer: { unmount: () => void } | undefined;

  await act(async () => {
    renderer = TestRenderer.create(createElement(HomeScreen));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return renderer as { unmount: () => void };
}

let mounted: { unmount: () => void } | undefined;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCard.workout = undefined;
  mockCard.renders = 0;
});

afterEach(async () => {
  await act(async () => mounted?.unmount());
  mounted = undefined;
});

describe("Home's active workout is the global unfinished session", () => {
  it("finds an unfinished session from a previous (backdated) day", async () => {
    await saveSession(session("old", yesterday, `${yesterday}T10:00:00.000Z`));

    mounted = await renderHome();

    expect(mockCard.workout?.id).toBe("old");
  });

  it("finds an unfinished session from today", async () => {
    await saveSession(session("now", today, `${today}T08:00:00.000Z`));

    mounted = await renderHome();

    expect(mockCard.workout?.id).toBe("now");
  });

  it("does not treat finished sessions as active", async () => {
    await saveSession(
      session("done-today", today, `${today}T08:00:00.000Z`, `${today}T09:00:00.000Z`),
    );
    await saveSession(
      session("done-old", yesterday, `${yesterday}T08:00:00.000Z`, `${yesterday}T09:00:00.000Z`),
    );

    mounted = await renderHome();

    expect(mockCard.workout).toBeUndefined();
  });

  it("shows the same session getActiveSession() and Forge Today's rule pick when several exist", async () => {
    // Stored directly: A4 stops the app creating this, but data can hold it.
    await saveSession(session("older", yesterday, `${yesterday}T07:00:00.000Z`));
    await saveSession(session("newer-open", yesterday, `${yesterday}T18:00:00.000Z`));
    await saveSession(
      session("finished-today", today, `${today}T08:00:00.000Z`, `${today}T09:00:00.000Z`),
    );

    mounted = await renderHome();

    const global = await getActiveSession();
    const forgeToday = (await getAllSessions()).find((entry) => !entry.endedAt);

    expect(global?.id).toBe("newer-open");
    expect(forgeToday?.id).toBe(global?.id);
    expect(mockCard.workout?.id).toBe(global?.id);
  });
});

describe("getActiveSession()", () => {
  it("returns null when nothing is unfinished", async () => {
    await saveSession(
      session("done", yesterday, `${yesterday}T08:00:00.000Z`, `${yesterday}T09:00:00.000Z`),
    );

    expect(await getActiveSession()).toBeNull();
  });

  it("ignores a finished session even when it is newer than the unfinished one", async () => {
    await saveSession(session("open-old", yesterday, `${yesterday}T08:00:00.000Z`));
    await saveSession(
      session("done-new", today, `${today}T08:00:00.000Z`, `${today}T09:00:00.000Z`),
    );

    expect((await getActiveSession())?.id).toBe("open-old");
  });
});
