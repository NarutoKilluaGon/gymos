import { createElement } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { TodayView } from "@/components/workouts/forge-today";
import type { ForgeData } from "@/hooks/use-forge";
import { msUntilNextMidnight, useTodayKey } from "@/hooks/use-today-key";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// Capture the sheet's onSave so tests can "tap Save" without its form UI.
const mockSheet: { onSave?: (entry: never) => Promise<boolean> } = {};

jest.mock("@/components/nutrition/more-sheets", () => ({
  CardioSheet: (props: { onSave: (entry: never) => Promise<boolean> }) => {
    mockSheet.onSave = props.onSave;

    return null;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => void = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Instance = { props: Record<string, unknown>; parent: Instance | null };

// 2026-10-04 is a Sunday, 2026-10-03 a Saturday.
const BEFORE_MIDNIGHT = new Date(2026, 9, 4, 23, 59, 30);
const AFTER_MIDNIGHT = new Date(2026, 9, 5, 0, 0, 10);

const data: ForgeData = {
  sessions: [],
  settings: { plans: [], activePlanId: "", restSeconds: 90, barKg: 20, routinesImported: true },
  custom: [],
  catalog: [],
  cardio: {},
  bodyweightKg: undefined,
};

let appStateHandler: ((state: AppStateStatus) => void) | undefined;

const onStart = jest.fn();
const onAddCardio = jest.fn(async () => true);

function mountToday() {
  let renderer: {
    root: { findAll: (p: (n: Instance & { children: unknown[] }) => boolean) => Instance[] };
    toJSON: () => unknown;
  };

  act(() => {
    renderer = TestRenderer.create(
      createElement(TodayView, {
        data,
        unit: "kg",
        weightKg: 80,
        onStart,
        onOpen: jest.fn(),
        onAddCardio,
        onRemoveCardio: jest.fn(),
        onGoPlan: jest.fn(),
      }),
    );
  });

  const texts = () => JSON.stringify(renderer.toJSON());

  // Pill labels are <Text> children; walk up to the Pressable that owns onPress.
  const press = (label: string) => {
    const text = renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === label)[0];
    let node: Instance | null = text ?? null;

    while (node && typeof node.props.onPress !== "function") node = node.parent;

    if (!node) throw new Error(`No pressable for "${label}"`);

    act(() => (node!.props.onPress as () => void)());
  };

  return { texts, press };
}

const tick = (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** Move the wall clock without firing timers or re-rendering (a stale mount). */
const jumpClock = (to: Date) => jest.setSystemTime(to);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BEFORE_MIDNIGHT);
  onStart.mockClear();
  onAddCardio.mockClear();
  mockSheet.onSave = undefined;
  appStateHandler = undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, handler: (s: AppStateStatus) => void) => {
    appStateHandler = handler;

    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("msUntilNextMidnight", () => {
  it("counts to the next local midnight", () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 4, 23, 59, 30))).toBe(30_000);
    expect(msUntilNextMidnight(new Date(2026, 9, 4, 12, 0, 0))).toBe(12 * 3_600_000);
  });

  it("always lands on a local 00:00 (DST-safe, any timezone)", () => {
    const samples = [
      new Date(2026, 2, 7, 10), new Date(2026, 2, 8, 10), new Date(2026, 2, 28, 22),
      new Date(2026, 9, 24, 22), new Date(2026, 10, 1, 10), new Date(2026, 10, 7, 10),
      new Date(2026, 11, 31, 23, 59),
    ];

    for (const now of samples) {
      const at = new Date(now.getTime() + msUntilNextMidnight(now));

      expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([0, 0, 0]);
      expect(at.getDate()).not.toBe(now.getDate());
    }
  });
});

describe("useTodayKey", () => {
  function mountHook() {
    const result = { current: "" };

    act(() => {
      TestRenderer.create(
        createElement(function Harness() {
          result.current = useTodayKey();

          return null;
        }),
      );
    });

    return result;
  }

  it("rolls over at local midnight and re-arms for the next one", () => {
    const key = mountHook();

    expect(key.current).toBe("2026-10-04");
    tick(29_000);
    expect(key.current).toBe("2026-10-04");
    tick(2_000);
    expect(key.current).toBe("2026-10-05");
    tick(24 * 3_600_000);
    expect(key.current).toBe("2026-10-06");
  });

  it("refreshes when the app returns to the foreground", () => {
    const key = mountHook();

    jumpClock(AFTER_MIDNIGHT);
    act(() => appStateHandler?.("background"));
    expect(key.current).toBe("2026-10-04");
    act(() => appStateHandler?.("active"));
    expect(key.current).toBe("2026-10-05");
  });
});

describe("Forge TodayView day handling", () => {
  it("normal day: starts today, not backdated, and stays put without a rollover", () => {
    const view = mountToday();

    tick(10_000);
    expect(view.texts()).toContain("Today");
    view.press("Blank workout");
    expect(onStart).toHaveBeenCalledWith({ dayId: null, date: "2026-10-04", backdated: false });
  });

  it("rolls over while mounted: Today follows the new day", () => {
    const view = mountToday();

    tick(31_000);
    expect(view.texts()).toContain("Today");
    view.press("Blank workout");
    expect(onStart).toHaveBeenCalledWith({ dayId: null, date: "2026-10-05", backdated: false });
  });

  it("foreground refresh moves Today to the new day", () => {
    const view = mountToday();

    jumpClock(AFTER_MIDNIGHT);
    act(() => appStateHandler?.("active"));
    view.press("Blank workout");
    expect(onStart).toHaveBeenCalledWith({ dayId: null, date: "2026-10-05", backdated: false });
  });

  it("resolves the date at tap time even if nothing re-rendered after midnight", () => {
    const view = mountToday();

    jumpClock(AFTER_MIDNIGHT); // no timer fired, no re-render: render state is stale
    view.press("Blank workout");
    expect(onStart).toHaveBeenCalledWith({ dayId: null, date: "2026-10-05", backdated: false });
  });

  it("logs cardio to the tap-time day after midnight", async () => {
    mountToday();
    jumpClock(AFTER_MIDNIGHT);

    await mockSheet.onSave?.({ name: "Run", kcal: 300 } as never);
    expect(onAddCardio).toHaveBeenCalledWith("2026-10-05", { name: "Run", kcal: 300 });
  });

  it("keeps a manually selected past day across the rollover", async () => {
    const view = mountToday();

    view.press("‹");
    expect(view.texts()).toContain("Sat 3 Oct");

    tick(31_000);
    expect(view.texts()).toContain("Sat 3 Oct");
    expect(view.texts()).not.toContain('"Today"');

    view.press("Blank workout");
    expect(onStart).toHaveBeenCalledWith({ dayId: null, date: "2026-10-03", backdated: true });

    await mockSheet.onSave?.({ name: "Walk", kcal: 100 } as never);
    expect(onAddCardio).toHaveBeenCalledWith("2026-10-03", { name: "Walk", kcal: 100 });
  });

  it("returning to today follows today again, including after a later rollover", () => {
    const view = mountToday();

    view.press("‹");
    view.press("›");
    expect(view.texts()).toContain("Today");
    view.press("Blank workout");
    expect(onStart).toHaveBeenLastCalledWith({ dayId: null, date: "2026-10-04", backdated: false });

    tick(31_000);
    view.press("Blank workout");
    expect(onStart).toHaveBeenLastCalledWith({ dayId: null, date: "2026-10-05", backdated: false });
  });
});
