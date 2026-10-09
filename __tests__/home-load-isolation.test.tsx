import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import HomeScreen from "@/app/index";
import { saveSession } from "@/storage/repositories/workout-sessions";
import { getNorthStar } from "@/storage/repositories/north-star";
import { getForgeSettings } from "@/storage/repositories/forge-settings";
import { getEnabledSupplementProgress } from "@/storage/repositories/supplement-logs";
import { getTodaySteps } from "@/storage/repositories/steps";
import { getTodayWater } from "@/storage/repositories/water";
import { getStreak } from "@/services/streak";
import type { PlanDay } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";
import { showToast } from "@/utils/toast";
import { getTodayKey } from "@/utils/date";

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
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));
jest.mock("@/contexts/modules-context", () => ({
  useModules: () => ({ enabled: { workouts: true, nutrition: true } }),
}));
jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({ unit: "kg", toggle: jest.fn() }),
}));

const mockCard: { workout?: WorkoutSession; plannedDay?: PlanDay | null; renders: number } = {
  renders: 0,
};

jest.mock("@/components/dashboard/workout-card", () => ({
  WorkoutCard: (props: { workout?: WorkoutSession; plannedDay?: PlanDay | null }) => {
    mockCard.workout = props.workout;
    mockCard.plannedDay = props.plannedDay;
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

const PLAN = {
  plans: [
    {
      id: "p1",
      name: "Plan",
      days: [{ id: "d1", name: "Push", exercises: [] }],
      schedule: {},
      rotate: true,
      deload: false,
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
  activePlanId: "p1",
  restSeconds: 90,
  barKg: 20,
  routinesImported: true,
};

const open = (): WorkoutSession => ({
  id: "running",
  name: "Running",
  startedAt: `${today}T08:00:00.000Z`,
  date: today,
  exercises: [],
});

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
  mockCard.plannedDay = undefined;
  mockCard.renders = 0;
  (showToast as jest.Mock).mockClear();
  (getForgeSettings as jest.Mock).mockResolvedValue(PLAN);
});

afterEach(async () => {
  await act(async () => mounted?.unmount());
  mounted = undefined;
});

const failing: [string, () => jest.Mock][] = [
  ["water", () => getTodayWater as jest.Mock],
  ["north star", () => getNorthStar as jest.Mock],
  ["steps", () => getTodaySteps as jest.Mock],
  ["streak", () => getStreak as jest.Mock],
  ["supplements", () => getEnabledSupplementProgress as jest.Mock],
];

describe("Home load isolation", () => {
  it.each(failing)(
    "still loads the active workout and planned day when %s fails",
    async (_name, source) => {
      await saveSession(open());
      source().mockRejectedValueOnce(new Error("boom"));

      mounted = await renderHome();

      expect(mockCard.workout?.id).toBe("running");
      expect(mockCard.plannedDay?.id).toBe("d1");
      expect(showToast).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith("Couldn't load today's data");
    },
  );

  it("still loads everything else when several sources fail at once", async () => {
    await saveSession(open());
    (getTodayWater as jest.Mock).mockRejectedValueOnce(new Error("a"));
    (getTodaySteps as jest.Mock).mockRejectedValueOnce(new Error("b"));
    (getStreak as jest.Mock).mockRejectedValueOnce(new Error("c"));

    mounted = await renderHome();

    expect(mockCard.workout?.id).toBe("running");
    expect(mockCard.plannedDay?.id).toBe("d1");
    // One toast for the whole load, not one per source.
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("does not toast when every source loads", async () => {
    mounted = await renderHome();

    expect(mockCard.plannedDay?.id).toBe("d1");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("a failing plan load leaves the workout card loaded and toasts once", async () => {
    await saveSession(open());
    (getForgeSettings as jest.Mock).mockRejectedValueOnce(new Error("boom"));

    mounted = await renderHome();

    expect(mockCard.workout?.id).toBe("running");
    expect(mockCard.plannedDay).toBeNull();
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
