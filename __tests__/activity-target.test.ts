import AsyncStorage from "@react-native-async-storage/async-storage";
import { DAILY_STORAGE_KEY } from "@/storage/constants";
import {
  addCardioToWorkout,
  finishWorkout,
  removeCardioFromWorkout,
} from "@/storage/repositories/workouts";
import { getTimeline } from "@/services/timeline";
import {
  calculateCalorieTarget,
  estimateActivityExpenditure,
} from "@/services/calorie-target";
import { getTodayKey } from "@/utils/date";
import type { DailyActivity } from "@/types/gymos";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
  };

  return {
    getStorage: jest.fn(async (key: string): Promise<unknown> => {
      const raw = state.store[key];
      return raw === undefined ? null : JSON.parse(raw);
    }),
    setStorage: jest.fn(
      async (key: string, value: unknown): Promise<void> => {
        state.store[key] = JSON.stringify(value);
      },
    ),
    removeStorage: jest.fn(async (key: string): Promise<void> => {
      delete state.store[key];
    }),
    StorageError: class StorageError extends Error {},
    __reset() {
      state.store = {};
    },
    __seed(key: string, value: unknown) {
      state.store[key] = JSON.stringify(value);
    },
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __reset(): void;
  __seed(key: string, value: unknown): void;
};

const MAINTENANCE = 2200;

function targetFor(items: readonly unknown[]) {
  return calculateCalorieTarget({
    maintenanceCalories: MAINTENANCE,
    goal: "maintain",
    timelineItems: items,
    todayKey: "2026-09-24",
  });
}

function workoutItem(durationMin: number) {
  return {
    kind: "workout",
    id: "e-w1",
    timestamp: "2026-09-24T08:00:00",
    name: "Push day",
    durationMs: durationMin * 60000,
    exerciseCount: 3,
  };
}

function cardioItem(durationMin: number, calories?: number) {
  return {
    kind: "cardio",
    id: "e-c1",
    timestamp: "2026-09-24T18:00:00",
    activity: "running",
    durationMin,
    ...(calories !== undefined ? { calories } : {}),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  storageMock.__reset();
  await AsyncStorage.clear();
});

describe("activity reversal (engine level)", () => {
  it("(F) adding a workout raises the target; removing it reverses", () => {
    const base = targetFor([]);
    expect(base.targetKcal).toBe(MAINTENANCE);

    const withWorkout = targetFor([workoutItem(30)]);
    expect(withWorkout.workoutKcal).toBe(180);
    expect(withWorkout.targetKcal).toBe(MAINTENANCE + 180);

    // Removing the workout item returns the exact base target.
    expect(targetFor([])).toEqual(base);
  });

  it("(G) adding cardio raises the target; removing it reverses", () => {
    const withCardio = targetFor([
      cardioItem(30, 250),
    ]);
    expect(withCardio.cardioKcal).toBe(250);
    expect(withCardio.targetKcal).toBe(MAINTENANCE + 250);

    expect(targetFor([]).targetKcal).toBe(MAINTENANCE);
  });

  it("(H) workout and cardio combine with no double-counting", () => {
    // One 30-min workout (180) + one 250-kcal cardio row = 430, each
    // counted exactly once.
    const combined = targetFor([
      workoutItem(30),
      cardioItem(30, 250),
    ]);

    expect(combined.workoutKcal).toBe(180);
    expect(combined.cardioKcal).toBe(250);
    expect(combined.activityKcal).toBe(430);
    expect(combined.targetKcal).toBe(MAINTENANCE + 430);

    // Dropping just the cardio leaves just the workout.
    expect(targetFor([workoutItem(30)]).targetKcal).toBe(
      MAINTENANCE + 180,
    );

    // Steps-shaped objects never contribute, even beside training.
    expect(
      targetFor([
        workoutItem(30),
        { kind: "steps", count: 12000, timestamp: "2026-09-24T12:00" },
      ]).targetKcal,
    ).toBe(MAINTENANCE + 180);
  });

  it("(I) malformed training rows contribute nothing", () => {
    expect(
      estimateActivityExpenditure([
        { kind: "workout" },
        { kind: "workout", durationMs: -100 },
        { kind: "cardio", durationMin: 0 },
        null,
      ]).totalKcal,
    ).toBe(0);
  });
});

describe("Part 11: logged workout/cardio data drives the target", () => {
  /** Seed one in-progress workout started an hour ago. */
  function seedWorkout(id: string, startedAt: string) {
    const todayKey = getTodayKey();
    const activity: DailyActivity = {
      date: todayKey,
      water: [],
      workouts: [
        {
          id,
          name: "Push day",
          startedAt,
          exercises: [],
        },
      ],
      meals: [],
      sleep: [],
      measurements: [],
      journal: [],
    };
    storageMock.__seed(DAILY_STORAGE_KEY, {
      [todayKey]: activity,
    });
  }

  function hourAgoIso(): string {
    return new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }

  async function targetNow(): Promise<number> {
    const items = await getTimeline();
    return calculateCalorieTarget({
      maintenanceCalories: MAINTENANCE,
      goal: "maintain",
      timelineItems: items,
      todayKey: getTodayKey(),
    }).targetKcal;
  }

  it("a finished logged workout raises the requirement", async () => {
    expect(await targetNow()).toBe(MAINTENANCE);

    seedWorkout("w1", hourAgoIso());
    const finished = await finishWorkout("w1");
    expect(finished?.endedAt).toBeDefined();

    // ~60 min at 6 kcal/min through the real repo → event → timeline.
    const items = await getTimeline();
    const workout = items.find((item) => item.kind === "workout");
    expect(workout).toBeDefined();
    expect(
      (workout as { durationMs: number }).durationMs,
    ).toBeGreaterThan(59 * 60 * 1000);

    expect(await targetNow()).toBe(MAINTENANCE + 360);
  });

  it("logged cardio raises the requirement; removing it reverses", async () => {
    seedWorkout("w1", hourAgoIso());
    await finishWorkout("w1");
    const base = await targetNow();
    expect(base).toBe(MAINTENANCE + 360);

    const entry = await addCardioToWorkout("w1", {
      activity: "running",
      durationMin: 30,
      calories: 250,
    });
    expect(entry).toBeDefined();

    // Stored cardio calories flow through timeline into the target.
    expect(await targetNow()).toBe(base + 250);

    // Removing the entry tombstones it out of derived views.
    await removeCardioFromWorkout("w1", entry!.id);

    const items = await getTimeline();
    expect(
      items.some((item) => item.kind === "cardio"),
    ).toBe(false);
    expect(await targetNow()).toBe(base);
  });

  it("removing a workout's only cardio leaves the workout share intact", async () => {
    seedWorkout("w1", hourAgoIso());
    await finishWorkout("w1");
    const entry = await addCardioToWorkout("w1", {
      activity: "cycling",
      durationMin: 20,
    });
    expect(entry).toBeDefined();

    // 20 min with no logged calories → duration fallback rate.
    const withBoth = await targetNow();
    expect(withBoth).toBeGreaterThan(MAINTENANCE + 360);

    await removeCardioFromWorkout("w1", entry!.id);
    expect(await targetNow()).toBe(MAINTENANCE + 360);
  });
});
