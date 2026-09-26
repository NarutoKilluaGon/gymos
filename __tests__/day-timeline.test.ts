import { DAILY_STORAGE_KEY } from "@/storage/constants";
import {
  getDailyMacroTotals,
} from "@/storage/repositories/meals";
import { buildDayTimeline } from "@/services/day-timeline";
import { mealToEstimate } from "@/services/meal-estimator";
import type { Meal } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";
import { getTodayKey } from "@/utils/date";

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

const STEPS_KEY = "@gymos/steps";

/** Fixed "today" so timestamps stay deterministic in any timezone. */
const TODAY = "2026-09-24";
const at = (time: string): string => `${TODAY}T${time}:00`;

function testMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: "m1",
    name: "Dosa platter",
    timestamp: at("12:00"),
    calories: 420,
    protein: 10,
    carbs: 68,
    fat: 13,
    fiber: 8,
    sodium: 1020,
    foods: [
      {
        name: "Masala dosa",
        amount: 1,
        unit: "piece",
        calories: 250,
        protein: 4,
        carbs: 40,
        fat: 9,
        fiber: 2,
        sodium: 380,
      },
    ],
    ...overrides,
  };
}

function workoutItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    kind: "workout",
    id: "e-w1",
    timestamp: at("08:00"),
    name: "Push day",
    exerciseCount: 3,
    durationMs: 3_600_000,
    ...overrides,
  } as TimelineItem;
}

function cardioItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    kind: "cardio",
    id: "e-c1",
    timestamp: at("18:00"),
    activity: "running",
    durationMin: 30,
    distanceKm: 5,
    calories: 300,
    ...overrides,
  } as TimelineItem;
}

beforeEach(() => {
  storageMock.__reset();
});

describe("S6: unified day timeline", () => {
  it("(a) orders the day chronologically with steps closing the rail", () => {
    const entries = buildDayTimeline({
      meals: [testMeal()],
      timelineItems: [cardioItem(), workoutItem()],
      steps: 5000,
      todayKey: TODAY,
    });

    expect(entries.map((entry) => entry.type)).toEqual([
      "activity", // 08:00 workout
      "meal", // 12:00 meal
      "activity", // 18:00 cardio
      "steps", // day total closes the rail
    ]);

    const [workout, meal, cardio] = entries;

    expect(workout).toMatchObject({ type: "activity" });
    expect(meal).toMatchObject({ type: "meal" });
    expect(cardio).toMatchObject({ type: "activity" });
  });

  it("(b) shows meals, workouts, and cardio together with full data", () => {
    const meal = testMeal();

    const entries = buildDayTimeline({
      meals: [meal],
      timelineItems: [workoutItem(), cardioItem()],
      steps: 0,
      todayKey: TODAY,
    });

    expect(entries).toHaveLength(3);

    const mealEntry = entries.find((entry) => entry.type === "meal");
    // The full meal record (breakdown + 16 nutrients) rides through
    // untouched — the S6A card and edit flow keep working on it.
    expect(mealEntry).toEqual({ type: "meal", meal });

    const workoutEntry = entries.find(
      (entry) =>
        entry.type === "activity" && entry.item.kind === "workout",
    );
    expect(workoutEntry).toMatchObject({
      type: "activity",
      item: { name: "Push day", exerciseCount: 3 },
    });

    const cardioEntry = entries.find(
      (entry) =>
        entry.type === "activity" && entry.item.kind === "cardio",
    );
    expect(cardioEntry).toMatchObject({
      type: "activity",
      item: {
        activity: "running",
        durationMin: 30,
        distanceKm: 5,
        calories: 300,
      },
    });
  });

  it("(b) never duplicates meals from the event log", () => {
    const entries = buildDayTimeline({
      meals: [testMeal()],
      timelineItems: [
        {
          kind: "meal",
          id: "e-meal-1",
          timestamp: at("12:00"),
          name: "Dosa platter",
          calories: 420,
        } as TimelineItem,
        workoutItem(),
      ],
      todayKey: TODAY,
    });

    // The event summary is skipped: the daily store's full card is the
    // single rendering of that meal.
    expect(
      entries.filter((entry) => entry.type === "meal"),
    ).toHaveLength(1);
    expect(
      entries.filter(
        (entry) =>
          entry.type === "activity" && entry.item.kind === "meal",
      ),
    ).toHaveLength(0);
  });

  it("(c) shows steps as a separate activity type", () => {
    const entries = buildDayTimeline({
      meals: [testMeal()],
      timelineItems: [workoutItem(), cardioItem()],
      steps: 8432,
      todayKey: TODAY,
    });

    const stepsEntries = entries.filter(
      (entry) => entry.type === "steps",
    );
    expect(stepsEntries).toHaveLength(1);
    expect(stepsEntries[0]).toEqual({ type: "steps", count: 8432 });

    // Steps are not folded into any meal, workout, or cardio entry.
    for (const entry of entries) {
      if (entry.type === "meal") {
        expect(entry.meal).not.toHaveProperty("steps");
      }
    }

    expect(
      entries.filter(
        (entry) =>
          entry.type === "activity" &&
          (entry.item.kind === "workout" ||
            entry.item.kind === "cardio"),
      ),
    ).toHaveLength(2);
  });

  it("(d) tolerates missing and empty event types", () => {
    // Nothing at all → empty timeline (the screen shows its empty state).
    expect(buildDayTimeline({ todayKey: TODAY })).toEqual([]);

    // Meals alone still display normally.
    const mealsOnly = buildDayTimeline({
      meals: [testMeal()],
      todayKey: TODAY,
    });
    expect(mealsOnly).toEqual([
      { type: "meal", meal: testMeal() },
    ]);

    // Zero/missing steps omit the steps row without breaking anything.
    expect(
      buildDayTimeline({
        meals: [testMeal()],
        timelineItems: [workoutItem()],
        steps: 0,
        todayKey: TODAY,
      }).map((entry) => entry.type),
    ).toEqual(["activity", "meal"]);

    // Yesterday's events never leak into today.
    expect(
      buildDayTimeline({
        meals: [],
        timelineItems: [
          workoutItem({ timestamp: "2026-09-23T08:00:00" }),
        ],
        todayKey: TODAY,
      }),
    ).toEqual([]);
  });

  it("(e) malformed or unknown event data never crashes the timeline", () => {
    const validMeal = testMeal();

    const entries = buildDayTimeline({
      meals: [
        null,
        undefined,
        42,
        { id: "bad-no-timestamp", name: "Mystery meal" },
        validMeal,
      ] as unknown as Meal[],
      timelineItems: [
        null,
        undefined,
        // Unknown future kind with an id + timestamp: kept for the
        // generic fallback row instead of crashing.
        {
          kind: "teleport",
          id: "x1",
          timestamp: at("09:00"),
        } as unknown as TimelineItem,
        // Missing timestamp: unusable on a chronological rail, skipped.
        { kind: "workout", id: "w-bad" } as unknown as TimelineItem,
        // Unparseable timestamp: skipped.
        {
          kind: "cardio",
          id: "c-bad",
          timestamp: "not-a-date",
        } as unknown as TimelineItem,
        workoutItem(),
      ] as unknown as TimelineItem[],
      steps: Number.NaN,
      todayKey: TODAY,
    });

    // No throw above; the timeline still renders everything usable.
    const kinds = entries.map((entry) =>
      entry.type === "activity" ? entry.item.kind : entry.type,
    );
    expect(kinds).toEqual([
      "workout", // 08:00
      "teleport", // 09:00 unknown kind, generic row
      "meal", // 12:00 valid meal
      "meal", // malformed meal kept last with a blank time
    ]);

    const malformedMeal = entries[entries.length - 1];
    expect(malformedMeal).toMatchObject({
      type: "meal",
      meal: { id: "bad-no-timestamp" },
    });
  });

  it("(f) existing meal behavior stays intact through the timeline", () => {
    const meal = testMeal();

    const entries = buildDayTimeline({
      meals: [meal],
      timelineItems: [workoutItem()],
      todayKey: TODAY,
    });

    const mealEntry = entries.find(
      (entry) => entry.type === "meal",
    );
    expect(mealEntry).toEqual({ type: "meal", meal });

    // The review/edit pipeline still sees the stored nutrients + the
    // foods breakdown on the timeline's meal record (mealToEstimate
    // preserves the record's key presence by design — S6A fold).
    if (mealEntry?.type !== "meal") {
      throw new Error("expected a meal entry");
    }

    const estimate = mealToEstimate(mealEntry.meal);
    expect(estimate.foods).toHaveLength(1);
    expect(estimate.foods[0]).toMatchObject({
      name: "Masala dosa",
      estimatedAmount: 1,
      unit: "piece",
      calories: 250,
      protein: 4,
      carbs: 40,
      fat: 9,
      fiber: 2,
      sodium: 380,
    });
    expect(estimate.totals).toMatchObject({
      calories: 420,
      protein: 10,
    });
  });

  it("(g) steps do not participate in calorie-target calculations", async () => {
    const todayKey = getTodayKey();
    const meal = testMeal({ timestamp: new Date().toISOString() });

    storageMock.__seed(DAILY_STORAGE_KEY, {
      [todayKey]: {
        date: todayKey,
        water: [],
        workouts: [],
        meals: [meal],
        sleep: [],
        measurements: [],
        journal: [],
      },
    });
    storageMock.__seed(STEPS_KEY, { [todayKey]: 12000 });

    // The totals path the summary card reads sums meals only: the
    // 12,000 stored steps change nothing.
    const totals = await getDailyMacroTotals(todayKey);

    expect(totals.calories).toBe(meal.calories);
    expect(totals.protein).toBe(meal.protein);
    expect(totals.carbs).toBe(meal.carbs);
    expect(totals.fat).toBe(meal.fat);
    expect(totals.calories).not.toBe(
      (meal.calories ?? 0) + 12000,
    );
  });
});
