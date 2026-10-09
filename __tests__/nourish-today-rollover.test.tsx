import { createElement } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { TodayView } from "@/components/nutrition/today-view";
import { useFoodLogger, type FoodLogger } from "@/hooks/use-food-logger";
import { resolveLogText } from "@/services/nourish/resolve-log";
import { buildDayModel } from "@/services/nourish/day-model";
import { buildRecords } from "@/services/nourish/insights";
import { DEFAULT_SETTINGS } from "@/services/nourish/targets";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import type { Meal, MealSlot } from "@/types/gymos";
import type { CardioLog, CardioMap, DraftItem } from "@/types/nourish";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// lucide-react-native ships ESM that Jest's transform ignores; the icons are
// decoration only, so stand in null components for the four TodayView uses.
jest.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Plus: () => null,
  Send: () => null,
  RotateCcw: () => null,
  Bookmark: () => null,
  Utensils: () => null,
  Sparkles: () => null,
}));

// The ring/bars draw with react-native-svg; they are irrelevant to day binding.
jest.mock("@/components/nutrition/nourish-ui", () => ({
  ...jest.requireActual("@/components/nutrition/nourish-ui"),
  Ring: ({ children }: { children: unknown }) => children,
  Bar: () => null,
}));

jest.mock("@/services/nourish/resolve-log", () => ({
  ...jest.requireActual("@/services/nourish/resolve-log"),
  resolveLogText: jest.fn(),
}));

// Capture what each sheet is handed so tests can "tap Save" without its form.
const mockUi: {
  logger?: FoodLogger;
  editSave?: (factor: number, slot: MealSlot, at: string) => void;
  cardioSave?: (entry: { name: string; detail: string; minutes: number; kcal: number }) => Promise<boolean>;
  savedLog?: (food: SavedFood) => void;
} = {};

jest.mock("@/components/nutrition/log-sheets", () => ({
  ReviewSheet: (props: { logger: FoodLogger }) => {
    mockUi.logger = props.logger;

    return null;
  },
  ManualSheet: () => null,
  EditEntrySheet: (props: { onSave: typeof mockUi.editSave }) => {
    mockUi.editSave = props.onSave;

    return null;
  },
}));

jest.mock("@/components/nutrition/more-sheets", () => ({
  CardioSheet: (props: { onSave: typeof mockUi.cardioSave }) => {
    mockUi.cardioSave = props.onSave;

    return null;
  },
  MicrosSheet: () => null,
  SuggestionsSheet: () => null,
  SavedSheet: (props: { onLog: typeof mockUi.savedLog }) => {
    mockUi.savedLog = props.onLog;

    return null;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => void = TestRenderer.act;
const actAsync: (callback: () => Promise<unknown>) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Instance = {
  props: Record<string, unknown>;
  parent: Instance | null;
  children: unknown[];
};

// 2026-10-04 is a Sunday, 2026-10-03 a Saturday.
const BEFORE_MIDNIGHT = new Date(2026, 9, 4, 23, 59, 30);
const LATE_EVENING = new Date(2026, 9, 4, 23, 58, 0);
const AFTER_MIDNIGHT = new Date(2026, 9, 5, 0, 0, 10);

let appStateHandler: ((state: AppStateStatus) => void) | undefined;

const mealAt = (id: string, name: string, at: Date, slot: MealSlot): Meal => ({
  id,
  name,
  timestamp: at.toISOString(),
  slot,
  qty: "1 serving",
  calories: 200,
  protein: 10,
  carbs: 30,
  fat: 5,
});

// A (Sun 4 Oct dinner), B (already on Mon 5 Oct), D (Sat 3 Oct lunch).
const MEAL_A = mealAt("a", "Dal", new Date(2026, 9, 4, 20, 0), "Dinner");
const MEAL_B = mealAt("b", "Toast", new Date(2026, 9, 5, 0, 5), "Snacks");
const MEAL_D = mealAt("d", "Rice", new Date(2026, 9, 3, 12, 0), "Lunch");

const RUN: CardioLog = {
  id: "run-1",
  name: "Run",
  detail: "30 min",
  minutes: 30,
  kcal: 300,
  loggedAt: new Date(2026, 9, 5, 0, 5).toISOString(),
};

const SAVED_MEAL = {
  id: "saved-1",
  name: "Usual dinner",
  slot: "Dinner",
  foods: [{ name: "Dal", calories: 200, protein: 10, carbs: 30, fat: 5 }],
  createdAt: new Date(2026, 9, 1).toISOString(),
} as unknown as SavedFood;

const draft = (): DraftItem => ({
  name: "Roti",
  qty: "2 rotis",
  calories: 200,
  protein: 6,
  carbs: 40,
  fat: 2,
  confidence: 0.9,
  multiplier: 1,
  source: "local",
});

const readyOutcome = () => ({ status: "ready" as const, items: [draft()] });

// Fresh per mount: restoreAllMocks in afterEach would strip shared mocks.
const ok = () => jest.fn<Promise<boolean>, unknown[]>(async () => true);

function makeActions() {
  return {
    logDraft: ok(),
    logSaved: ok(),
    repeatInto: ok(),
    setFeel: ok(),
    addCardio: ok(),
    removeCardio: ok(),
    editEntry: ok(),
    removeEntry: ok(),
    saveSection: ok(),
    removeSaved: ok(),
  };
}

type Actions = ReturnType<typeof makeActions>;

function mountToday() {
  const actions = makeActions();
  const meals = [MEAL_A, MEAL_B, MEAL_D];
  const cardio: CardioMap = { "2026-10-05": [RUN] };
  const feel = {};
  const nourish = {
    data: {
      meals,
      feel,
      cardio,
      settings: DEFAULT_SETTINGS,
      saved: [SAVED_MEAL],
      weights: [],
      workoutCardio: {},
    },
    records: buildRecords(meals, feel, {}),
    model: (key: string) =>
      buildDayModel({
        key,
        meals,
        feel,
        cardio,
        workoutCardio: {},
        settings: DEFAULT_SETTINGS,
      }),
    actions,
    weightKg: 70,
  };

  let renderer: {
    root: { findAll: (p: (n: Instance) => boolean) => Instance[] };
    toJSON: () => unknown;
  };

  act(() => {
    renderer = TestRenderer.create(createElement(TodayView, { nourish: nourish as never }));
  });

  const texts = () => JSON.stringify(renderer.toJSON());

  // Match a Pressable by accessibilityLabel or by a <Text> label, then walk
  // up to the node that owns onPress.
  const press = (label: string) => {
    const hit = renderer.root.findAll(
      (n) =>
        n.props?.accessibilityLabel === label ||
        (n.children?.length === 1 && n.children[0] === label),
    )[0];
    let node: Instance | null = hit ?? null;

    while (node && typeof node.props.onPress !== "function") node = node.parent;

    if (!node) throw new Error(`No pressable for "${label}"`);

    act(() => (node!.props.onPress as () => void)());
  };

  return { actions, texts, press };
}

const run = (callback: () => unknown) =>
  actAsync(async () => {
    await callback();
  });

const tick = (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** Move the wall clock without firing timers or re-rendering (a stale mount). */
const jumpClock = (to: Date) => jest.setSystemTime(to);

const lastCall = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1] as unknown[];

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BEFORE_MIDNIGHT);
  mockUi.logger = undefined;
  mockUi.editSave = undefined;
  mockUi.cardioSave = undefined;
  mockUi.savedLog = undefined;
  appStateHandler = undefined;
  (resolveLogText as jest.Mock).mockReset();
  (resolveLogText as jest.Mock).mockResolvedValue(readyOutcome());
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    handler: (s: AppStateStatus) => void,
  ) => {
    appStateHandler = handler;

    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Nourish TodayView day handling", () => {
  it("1. normal day: food, saved meal and cardio all log to today", async () => {
    const view = mountToday();

    tick(10_000);
    expect(view.texts()).toContain('"Today"');

    await run(() => mockUi.logger!.submit("2 rotis"));
    await run(() => mockUi.logger!.confirm());
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({
      dayKey: "2026-10-04",
      at: "23:59",
    });

    await run(() => mockUi.savedLog!(SAVED_MEAL));
    expect(view.actions.logSaved).toHaveBeenLastCalledWith(SAVED_MEAL, "2026-10-04");

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-04", expect.anything());
  });

  it("2. midnight timer: Today follows the new day for every write", async () => {
    const view = mountToday();

    tick(31_000);
    expect(view.texts()).toContain('"Today"');
    expect(view.texts()).not.toContain('"Yesterday"');

    await run(() => mockUi.logger!.submit("2 rotis"));
    await run(() => mockUi.logger!.confirm());
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({ dayKey: "2026-10-05" });

    await run(() => mockUi.savedLog!(SAVED_MEAL));
    expect(view.actions.logSaved).toHaveBeenLastCalledWith(SAVED_MEAL, "2026-10-05");

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-05", expect.anything());

    // Feel and cardio removal act on what is on screen: the new day's entries.
    view.press("Just right");
    expect(view.actions.setFeel).toHaveBeenLastCalledWith("2026-10-05", "Snacks", 2);
    view.press("Remove Run");
    expect(view.actions.removeCardio).toHaveBeenLastCalledWith("2026-10-05", "run-1");
  });

  it("3. foreground refresh moves Today to the new day", async () => {
    const view = mountToday();

    jumpClock(AFTER_MIDNIGHT);
    act(() => appStateHandler?.("active"));
    expect(view.texts()).toContain('"Today"');
    expect(view.texts()).not.toContain('"Yesterday"');

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-05", expect.anything());
  });

  it("4. resolves the day at tap time even if nothing re-rendered after midnight", async () => {
    const view = mountToday();

    jumpClock(AFTER_MIDNIGHT); // no timer fired, no re-render: render state is stale

    await run(() => mockUi.logger!.submit("2 rotis"));
    expect(mockUi.logger!.review).toMatchObject({ dayKey: "2026-10-05", at: "00:00" });
    await run(() => mockUi.logger!.confirm());
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({ dayKey: "2026-10-05" });

    await run(() => mockUi.savedLog!(SAVED_MEAL));
    expect(view.actions.logSaved).toHaveBeenLastCalledWith(SAVED_MEAL, "2026-10-05");

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-05", expect.anything());

    // "Repeat yesterday" copies the day before the day it lands on.
    view.press("Repeat yesterday");

    const [source, target] = lastCall(view.actions.repeatInto as jest.Mock) as [Meal[], string];

    expect(target).toBe("2026-10-05");
    expect(source.map((meal) => meal.id)).toEqual(["a"]);
  });

  it("5. a deliberately selected past day stays pinned across the rollover", async () => {
    const view = mountToday();

    view.press("Previous day");
    expect(view.texts()).toContain('"Yesterday"');

    tick(31_000);
    expect(view.texts()).toContain("Sat, 3 Oct");
    expect(view.texts()).not.toContain('"Today"');

    await run(() => mockUi.logger!.submit("2 rotis"));
    expect(mockUi.logger!.review).toMatchObject({ dayKey: "2026-10-03", at: "" });
    await run(() => mockUi.logger!.confirm());
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({
      dayKey: "2026-10-03",
      at: null,
    });

    await run(() => mockUi.savedLog!(SAVED_MEAL));
    expect(view.actions.logSaved).toHaveBeenLastCalledWith(SAVED_MEAL, "2026-10-03");

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-03", expect.anything());
  });

  it("6. returning to today restores live following, including after a later rollover", async () => {
    const view = mountToday();

    view.press("Previous day");
    view.press("Next day");
    expect(view.texts()).toContain('"Today"');

    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-04", expect.anything());

    tick(31_000);
    expect(view.texts()).toContain('"Today"');
    await run(() => mockUi.cardioSave!({ name: "Walk", detail: "", minutes: 10, kcal: 50 }));
    expect(view.actions.addCardio).toHaveBeenLastCalledWith("2026-10-05", expect.anything());
  });

  it("7. review opened before midnight and confirmed after keeps its day and time", async () => {
    jumpClock(LATE_EVENING);

    const view = mountToday();

    await run(() => mockUi.logger!.submit("2 rotis"));
    expect(mockUi.logger!.review).toMatchObject({ dayKey: "2026-10-04", at: "23:58" });

    tick(121_000); // past midnight: the screen now follows 5 Oct
    expect(view.texts()).toContain('"Today"');
    expect(mockUi.logger!.review).toMatchObject({ dayKey: "2026-10-04", at: "23:58" });

    await run(() => mockUi.logger!.confirm());
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({
      dayKey: "2026-10-04",
      at: "23:58",
    });
  });

  it("8. manual entry opened before midnight and saved after keeps its day and time", async () => {
    jumpClock(LATE_EVENING);

    const view = mountToday();

    view.press("Add manually");
    expect(mockUi.logger!.manual).toMatchObject({ dayKey: "2026-10-04", at: "23:58" });

    tick(121_000);
    expect(view.texts()).toContain('"Today"');

    await run(() => mockUi.logger!.saveManual(draft(), "Dinner"));
    expect(lastCall(view.actions.logDraft as jest.Mock)[0]).toMatchObject({
      dayKey: "2026-10-04",
      at: "23:58",
      slot: "Dinner",
    });
  });

  it("9. editing an entry keeps the entry's own date across midnight", async () => {
    jumpClock(LATE_EVENING);

    const view = mountToday();

    view.press("Edit Dal");
    tick(121_000); // the screen rolls to 5 Oct while the edit sheet stays open
    expect(view.texts()).toContain('"Today"');

    await run(() => mockUi.editSave?.(1, "Dinner", "20:30"));
    expect(view.actions.editEntry).toHaveBeenCalledTimes(1);
    expect(lastCall(view.actions.editEntry as jest.Mock)[1]).toMatchObject({
      dayKey: "2026-10-04",
      at: "20:30",
    });
  });
});

describe("useFoodLogger date/time context", () => {
  const NO_SLOTS: ReadonlySet<MealSlot> = new Set<MealSlot>();
  const NO_SAVED: readonly SavedFood[] = [];

  function mountLogger(
    initial: { dayKey: string; resolveDay?: () => string },
    save: Actions["logDraft"] = makeActions().logDraft,
  ) {
    const ref: { current?: FoodLogger } = {};
    const Harness = (props: { dayKey: string; resolveDay?: () => string }) => {
      ref.current = useFoodLogger({
        dayKey: props.dayKey,
        ...(props.resolveDay ? { resolveDay: props.resolveDay } : {}),
        saved: NO_SAVED,
        filled: NO_SLOTS,
        save: save as never,
      });

      return null;
    };
    let renderer: { update: (element: unknown) => void };

    act(() => {
      renderer = TestRenderer.create(createElement(Harness, initial));
    });

    return {
      save,
      logger: () => ref.current!,
      rerender: (props: { dayKey: string; resolveDay?: () => string }) =>
        act(() => renderer.update(createElement(Harness, props))),
    };
  }

  it("10a. today: stamps the current clock time on the current day", async () => {
    jumpClock(new Date(2026, 9, 4, 12, 34, 0));

    const { logger } = mountLogger({ dayKey: "2026-10-04" });

    await run(() => logger().submit("2 rotis"));
    expect(logger().review).toMatchObject({ dayKey: "2026-10-04", at: "12:34" });
  });

  it("10b. past day: no clock time, and the day is the one resolved", async () => {
    jumpClock(new Date(2026, 9, 4, 12, 34, 0));

    const { logger, save } = mountLogger({ dayKey: "2026-10-03", resolveDay: () => "2026-10-03" });

    await run(() => logger().submit("2 rotis"));
    expect(logger().review).toMatchObject({ dayKey: "2026-10-03", at: "" });
    await run(() => logger().confirm());
    expect(lastCall(save as unknown as jest.Mock)[0]).toMatchObject({ dayKey: "2026-10-03", at: null });
  });

  it("10c. without resolveDay it falls back to the dayKey input", async () => {
    jumpClock(new Date(2026, 9, 4, 12, 34, 0));

    const { logger } = mountLogger({ dayKey: "2026-10-04" });

    act(() => logger().openReview([draft()]));
    expect(logger().review).toMatchObject({ dayKey: "2026-10-04" });
  });

  it("10d. a lookup that finishes after midnight still logs to the day it started", async () => {
    jumpClock(BEFORE_MIDNIGHT);

    let finish: (value: ReturnType<typeof readyOutcome>) => void = () => undefined;

    (resolveLogText as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const { logger } = mountLogger({ dayKey: "2026-10-04" });
    await run(async () => {
      const pending = logger().submit("2 rotis");

      jumpClock(AFTER_MIDNIGHT);
      finish(readyOutcome());
      await pending;
    });
    expect(logger().review).toMatchObject({ dayKey: "2026-10-04", at: "23:59" });
  });

  it("10e. an offline/unreadable lookup opens the manual sheet with the same snapshot", async () => {
    jumpClock(LATE_EVENING);
    (resolveLogText as jest.Mock).mockResolvedValue({
      status: "manual",
      name: "Dal",
      reason: "unreadable",
    });

    const { logger } = mountLogger({ dayKey: "2026-10-04" });

    await run(() => logger().submit("dal"));
    expect(logger().manual).toMatchObject({ name: "Dal", dayKey: "2026-10-04", at: "23:58" });
  });

  it("10f. confirming uses the snapshot even if the hook's day input moves on", async () => {
    jumpClock(LATE_EVENING);

    const { logger, save, rerender } = mountLogger({ dayKey: "2026-10-04" });

    await run(() => logger().submit("2 rotis"));
    jumpClock(AFTER_MIDNIGHT);
    rerender({ dayKey: "2026-10-05" });
    await run(() => logger().confirm());
    expect(lastCall(save as unknown as jest.Mock)[0]).toMatchObject({
      dayKey: "2026-10-04",
      at: "23:58",
    });
  });
});
