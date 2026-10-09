import { createElement } from "react";

import { useForge } from "@/hooks/use-forge";
import { buildCatalog } from "@/services/forge/catalog";
import { getAllSessions } from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";
import { showToast } from "@/utils/toast";

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/hooks/use-weight-unit", () => ({ useWeightUnit: () => ({ unit: "kg" }) }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// `buildCatalog` runs only when a reload commits, so it marks a commit.
jest.mock("@/services/forge/catalog", () => {
  const actual = jest.requireActual("@/services/forge/catalog");

  return { ...actual, buildCatalog: jest.fn(actual.buildCatalog) };
});

jest.mock("@/storage/repositories/forge-settings", () => ({
  getForgeSettings: jest.fn(async () => ({
    plans: [],
    activePlanId: "",
    restSeconds: 90,
    barKg: 20,
    routinesImported: true,
  })),
  getCustomExercises: jest.fn(async () => []),
  addCustomExercise: jest.fn(),
  deleteCustomExercise: jest.fn(),
  updateForgeSettings: jest.fn(),
}));

// Sessions are the load each test controls; everything else stays real.
jest.mock("@/storage/repositories/workout-sessions", () => {
  const actual = jest.requireActual("@/storage/repositories/workout-sessions");

  return { ...actual, getAllSessions: jest.fn() };
});

const mockGetAll = getAllSessions as jest.MockedFunction<typeof getAllSessions>;
const mockCatalog = buildCatalog as jest.MockedFunction<typeof buildCatalog>;
const mockToast = showToast as jest.MockedFunction<typeof showToast>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const session = (id: string): WorkoutSession => ({
  id,
  name: id,
  date: "2026-03-01",
  startedAt: "2026-03-01T10:00:00.000Z",
  endedAt: "2026-03-01T11:00:00.000Z",
  exercises: [],
});

function mount() {
  const result = { current: undefined as unknown as ReturnType<typeof useForge> };
  let renderer: { unmount: () => void };

  function Harness() {
    result.current = useForge();

    return null;
  }

  void act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return { result, unmount: () => act(() => renderer.unmount()) };
}

const ids = (hook: { current: ReturnType<typeof useForge> }) =>
  hook.current.data?.sessions.map((entry) => entry.id);

beforeEach(() => {
  mockGetAll.mockReset();
  mockCatalog.mockClear();
  mockToast.mockClear();
});

describe("useForge reload sequencing", () => {
  it("a lone reload still commits", async () => {
    mockGetAll.mockResolvedValueOnce([session("only")]);

    const { result } = mount();

    await act(async () => {
      await result.current.reload();
    });

    expect(ids(result)).toEqual(["only"]);
  });

  it("two overlapping reloads resolving out of order: the newest result wins", async () => {
    const older = deferred<WorkoutSession[]>();
    const newer = deferred<WorkoutSession[]>();

    mockGetAll.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { result } = mount();
    let first!: Promise<void>;
    let second!: Promise<void>;

    await act(async () => {
      first = result.current.reload();
      second = result.current.reload();
    });

    // The newer reload finishes first and commits.
    await act(async () => {
      newer.resolve([session("new")]);
      await second;
    });
    expect(ids(result)).toEqual(["new"]);

    // The older one finishes late holding an older snapshot: it must not overwrite.
    await act(async () => {
      older.resolve([session("old")]);
      await first;
    });
    expect(ids(result)).toEqual(["new"]);
  });

  it("overlapping reloads resolving in order still end on the newest", async () => {
    const older = deferred<WorkoutSession[]>();
    const newer = deferred<WorkoutSession[]>();

    mockGetAll.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { result } = mount();
    let first!: Promise<void>;
    let second!: Promise<void>;

    await act(async () => {
      first = result.current.reload();
      second = result.current.reload();
    });
    await act(async () => {
      older.resolve([session("old")]);
      await first;
    });
    await act(async () => {
      newer.resolve([session("new")]);
      await second;
    });

    expect(ids(result)).toEqual(["new"]);
  });

  it("unmounting while a reload is pending commits nothing", async () => {
    const pending = deferred<WorkoutSession[]>();

    mockGetAll.mockReturnValueOnce(pending.promise);

    const { result, unmount } = mount();
    let reload!: Promise<void>;

    await act(async () => {
      reload = result.current.reload();
    });
    await unmount();
    mockCatalog.mockClear();

    await act(async () => {
      pending.resolve([session("late")]);
      await reload;
    });

    // `buildCatalog` only runs on the commit path.
    expect(mockCatalog).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("a failed reload after unmount shows no toast", async () => {
    const pending = deferred<WorkoutSession[]>();

    mockGetAll.mockReturnValueOnce(pending.promise);

    const { result, unmount } = mount();
    let reload!: Promise<void>;

    await act(async () => {
      reload = result.current.reload();
    });
    await unmount();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await reload;
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("the newest reload failing still toasts", async () => {
    mockGetAll.mockRejectedValueOnce(new Error("storage unavailable"));

    const { result } = mount();

    await act(async () => {
      await result.current.reload();
    });

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Couldn't load workouts");
  });

  it("a superseded reload failing late neither toasts nor clobbers the newer data", async () => {
    const older = deferred<WorkoutSession[]>();

    mockGetAll
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce([session("new")]);

    const { result } = mount();
    let first!: Promise<void>;
    let second!: Promise<void>;

    await act(async () => {
      first = result.current.reload();
      second = result.current.reload();
    });
    await act(async () => {
      await second;
    });
    await act(async () => {
      older.reject(new Error("storage unavailable"));
      await first;
    });

    expect(ids(result)).toEqual(["new"]);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
