import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";
import { AppState } from "react-native";

import { useNourish } from "@/hooks/use-nourish";
import { addCardioLog } from "@/storage/repositories/nourish-cardio";
import { addMeals } from "@/storage/repositories/meals";
import type { Meal } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// Run the focus effect once on mount so the hook loads like it does on screen.
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").useEffect(callback, [callback]),
}));

// Only the appending writes are wrapped, so a test can hold one open (or fail
// it) and count real invocations. Each delegates to the real implementation
// unless a test overrides it (see beforeEach).
jest.mock("@/storage/repositories/meals", () => ({
  ...jest.requireActual("@/storage/repositories/meals"),
  addMeals: jest.fn(),
}));

jest.mock("@/storage/repositories/nourish-cardio", () => ({
  ...jest.requireActual("@/storage/repositories/nourish-cardio"),
  addCardioLog: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Nourish = ReturnType<typeof useNourish>;

const mockAddMeals = addMeals as unknown as jest.Mock;
const mockAddCardioLog = addCardioLog as unknown as jest.Mock;

const TODAY = getTodayKey();

const ITEM: DraftItem = {
  name: "Dal",
  qty: "1 serving",
  calories: 200,
  protein: 10,
  carbs: 30,
  fat: 5,
  confidence: 1,
  multiplier: 1,
  source: "manual",
};

const DRAFT = { items: [ITEM], slot: "Dinner" as const, at: "20:00", dayKey: TODAY };
const CARDIO = { name: "Walk", detail: "30 min", minutes: 30, kcal: 120 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const renderers: { unmount: () => void }[] = [];

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function mountHook() {
  const result = { current: undefined as unknown as Nourish };

  function Harness() {
    result.current = useNourish();

    return null;
  }

  act(() => {
    renderers.push(TestRenderer.create(createElement(Harness)));
  });
  await settle();

  return { result };
}

let appStateSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  (showToast as jest.Mock).mockClear();

  const realMeals = jest.requireActual("@/storage/repositories/meals");
  const realCardio = jest.requireActual("@/storage/repositories/nourish-cardio");

  mockAddMeals.mockReset();
  mockAddMeals.mockImplementation((...args: unknown[]) => realMeals.addMeals(...args));
  mockAddCardioLog.mockReset();
  mockAddCardioLog.mockImplementation((...args: unknown[]) =>
    realCardio.addCardioLog(...args),
  );

  appStateSpy = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((() => ({ remove: jest.fn() })) as never);
});

afterEach(() => {
  while (renderers.length > 0) {
    const renderer = renderers.pop()!;

    act(() => renderer.unmount());
  }

  appStateSpy.mockRestore();
});

type Case = [string, (nourish: Nourish) => Promise<boolean>, () => jest.Mock];

const cases: Case[] = [
  ["logDraft", (n) => n.actions.logDraft(DRAFT), () => mockAddMeals],
  [
    "addEntries",
    (n) =>
      n.actions.addEntries([
        {
          name: "Dal",
          macros: { calories: 200, protein: 10, carbs: 30, fat: 5 },
          slot: "Dinner",
          qty: "1 serving",
          timestamp: new Date().toISOString(),
        },
      ]),
    () => mockAddMeals,
  ],
  ["addCardio", (n) => n.actions.addCardio(TODAY, CARDIO), () => mockAddCardioLog],
];

describe("Nourish logDraft / addEntries / addCardio ignore a call while one is running", () => {
  it.each(cases)("%s called twice while the first write is pending writes once", async (_n, call, write) => {
    const { result } = await mountHook();
    const pending = deferred<unknown>();

    write().mockImplementationOnce(() => pending.promise);

    const first = call(result.current);
    const second = call(result.current);

    expect(await second).toBe(false);
    expect(write()).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve([] as Meal[]);
      await first;
    });

    expect(await first).toBe(true);
    expect(write()).toHaveBeenCalledTimes(1);
  });

  it.each(cases)("%s works again once the first call has finished", async (_n, call, write) => {
    const { result } = await mountHook();

    await act(async () => {
      expect(await call(result.current)).toBe(true);
    });
    await act(async () => {
      expect(await call(result.current)).toBe(true);
    });

    expect(write()).toHaveBeenCalledTimes(2);
  });

  it.each(cases)("a failed %s releases the guard so it can be retried", async (_n, call, write) => {
    const { result } = await mountHook();
    const pending = deferred<never>();

    write().mockImplementationOnce(() => pending.promise);

    const first = call(result.current);

    expect(await call(result.current)).toBe(false);

    await act(async () => {
      pending.reject(new Error("disk full"));
      await first;
    });

    expect(await first).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(await call(result.current)).toBe(true);
    });

    expect(write()).toHaveBeenCalledTimes(2);
  });

  it("logDraft and addCardio are independent guards", async () => {
    const { result } = await mountHook();
    const pending = deferred<unknown>();

    mockAddMeals.mockImplementationOnce(() => pending.promise);

    const draft = result.current.actions.logDraft(DRAFT);
    let cardio = false;

    await act(async () => {
      cardio = await result.current.actions.addCardio(TODAY, CARDIO);
    });

    expect(cardio).toBe(true);

    await act(async () => {
      pending.resolve([] as Meal[]);
      await draft;
    });
  });
});
