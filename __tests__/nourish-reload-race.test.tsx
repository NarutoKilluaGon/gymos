import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import { useNourish } from "@/hooks/use-nourish";
import { deleteMeal, getAllMeals } from "@/storage/repositories/meals";
import type { Meal } from "@/types/gymos";
import { showToast } from "@/utils/toast";

jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// Reloads are triggered by hand in these tests, so the focus effect is inert.
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));

// The meals read is the one a test holds open to control completion order;
// everything else in a reload runs for real against the AsyncStorage mock.
jest.mock("@/storage/repositories/meals", () => ({
  ...jest.requireActual("@/storage/repositories/meals"),
  getAllMeals: jest.fn(),
  deleteMeal: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Nourish = ReturnType<typeof useNourish>;

const mockGetAllMeals = getAllMeals as jest.Mock;
const mockDeleteMeal = deleteMeal as jest.Mock;

const NEW_MEAL: Meal = {
  id: "new",
  name: "Dal",
  timestamp: "2026-10-05T12:00:00.000Z",
  slot: "Lunch",
  calories: 200,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function mountHook() {
  const result = { current: undefined as unknown as Nourish, renders: 0 };

  function Harness() {
    result.current = useNourish();
    result.renders += 1;

    return null;
  }

  let renderer: { unmount: () => void };

  void act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return { result, unmount: () => act(() => renderer.unmount()) };
}

/**
 * Start a reload and hand back its promise without waiting for it. This must
 * not be an async function: returning the pending promise from one would make
 * `await startReload(...)` wait for the (intentionally unresolved) reload.
 */
function startReload(result: { current: Nourish }) {
  let pending!: Promise<void>;

  void act(() => {
    pending = result.current.reload();
  });

  return pending;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  (showToast as jest.Mock).mockClear();
  mockGetAllMeals.mockReset();
  mockGetAllMeals.mockImplementation(() =>
    jest.requireActual("@/storage/repositories/meals").getAllMeals(),
  );
  mockDeleteMeal.mockReset();
  mockDeleteMeal.mockImplementation((id: string) =>
    jest.requireActual("@/storage/repositories/meals").deleteMeal(id),
  );
});

describe("Nourish reload ordering", () => {
  it("1. an older reload finishing last cannot overwrite a newer one", async () => {
    const { result } = mountHook();
    const readA = deferred<Meal[]>();
    const readB = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => readA.promise);
    mockGetAllMeals.mockImplementationOnce(() => readB.promise);

    const a = startReload(result);
    const b = startReload(result);

    // B (newer) finishes first with the current data...
    await act(async () => {
      readB.resolve([NEW_MEAL]);
      await b;
    });
    expect(result.current.data?.meals).toEqual([NEW_MEAL]);

    // ...then A finishes afterwards holding the older snapshot.
    await act(async () => {
      readA.resolve([]);
      await a;
    });

    expect(result.current.data?.meals).toEqual([NEW_MEAL]);
  });

  it("2. the latest reload still commits", async () => {
    const { result } = mountHook();
    const read = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => read.promise);

    const reload = startReload(result);

    expect(result.current.data).toBeNull();

    await act(async () => {
      read.resolve([NEW_MEAL]);
      await reload;
    });

    expect(result.current.data?.meals).toEqual([NEW_MEAL]);
  });

  it("2b. a superseded reload that fails shows no error and keeps newer data", async () => {
    const { result } = mountHook();
    const readA = deferred<Meal[]>();
    const readB = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => readA.promise);
    mockGetAllMeals.mockImplementationOnce(() => readB.promise);

    const a = startReload(result);
    const b = startReload(result);

    await act(async () => {
      readB.resolve([NEW_MEAL]);
      await b;
    });
    await act(async () => {
      readA.reject(new Error("slow read failed"));
      await a;
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.data?.meals).toEqual([NEW_MEAL]);
  });

  it("2c. the newest reload failing still reports the error", async () => {
    const { result } = mountHook();
    const read = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => read.promise);

    const reload = startReload(result);

    await act(async () => {
      read.reject(new Error("read failed"));
      await reload;
    });

    expect(showToast).toHaveBeenCalledWith("Couldn't load nutrition");
  });

  it("3. a reload resolving after unmount commits nothing and throws nothing", async () => {
    const { result, unmount } = mountHook();
    const read = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => read.promise);

    const reload = startReload(result);
    const rendersBefore = result.renders;

    await unmount();

    await act(async () => {
      read.resolve([NEW_MEAL]);
      await expect(reload).resolves.toBeUndefined();
    });

    expect(result.renders).toBe(rendersBefore);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("3b. a reload failing after unmount shows no error", async () => {
    const { result, unmount } = mountHook();
    const read = deferred<Meal[]>();

    mockGetAllMeals.mockImplementationOnce(() => read.promise);

    const reload = startReload(result);

    await unmount();

    await act(async () => {
      read.reject(new Error("read failed"));
      await reload;
    });

    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("Nourish write then reload", () => {
  it("4. a successful write reloads and the screen shows what was stored", async () => {
    const { result } = mountHook();
    let ok = false;

    await act(async () => {
      ok = await result.current.actions.setFeel("2026-10-05", "Lunch", 2);
    });

    expect(ok).toBe(true);
    expect(mockGetAllMeals).toHaveBeenCalledTimes(1);
    expect(result.current.data?.feel["2026-10-05"]?.Lunch).toBe(2);
  });

  it("4b. a write's refresh wins over an older reload still in flight", async () => {
    const { result } = mountHook();
    const slow = deferred<Meal[]>();

    // An earlier reload (e.g. the focus one) is stuck on a slow meals read.
    mockGetAllMeals.mockImplementationOnce(() => slow.promise);

    const earlier = startReload(result);

    // A write lands and refreshes; its reload reads the real (current) store.
    await act(async () => {
      await result.current.actions.setFeel("2026-10-05", "Lunch", 2);
    });
    expect(result.current.data?.feel["2026-10-05"]?.Lunch).toBe(2);

    // The older reload finally finishes with its pre-write snapshot.
    await act(async () => {
      slow.resolve([]);
      await earlier;
    });

    expect(result.current.data?.feel["2026-10-05"]?.Lunch).toBe(2);
  });

  it("4c. a failed write still toasts, reloads and returns false", async () => {
    const { result } = mountHook();
    let ok = true;

    mockDeleteMeal.mockRejectedValueOnce(new Error("disk full"));

    await act(async () => {
      ok = await result.current.actions.removeEntry("missing");
    });

    expect(ok).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Couldn't delete");
    expect(mockGetAllMeals).toHaveBeenCalledTimes(1);
    expect(result.current.data).not.toBeNull();
  });
});
