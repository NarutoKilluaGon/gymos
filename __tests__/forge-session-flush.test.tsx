import { createElement } from "react";

import { useForge, useLiveSession } from "@/hooks/use-forge";
import {
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> =
  TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal renderHook: mounts a component that calls the hook each render. */
function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: undefined as T };

  function Harness() {
    result.current = hook();

    return null;
  }

  void act(() => {
    TestRenderer.create(createElement(Harness));
  });

  return { result };
}

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("@/storage/repositories/workout-sessions", () => ({
  saveSession: jest.fn(),
  getAllSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockGetAll = getAllSessions as jest.MockedFunction<typeof getAllSessions>;

const mk = (extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: "s1",
  name: "Push",
  startedAt: "2026-03-01T10:00:00.000Z",
  date: "2026-03-01",
  exercises: [],
  ...extra,
});

type Deferred = { resolve: () => void; reject: (error: Error) => void };

/** A saveSession whose writes only finish when the test lets them. */
function controlledSaves() {
  const writes: { saved: WorkoutSession; gate: Deferred }[] = [];

  mockSave.mockImplementation(
    (session) =>
      new Promise<WorkoutSession>((resolve, reject) => {
        writes.push({
          saved: session,
          gate: { resolve: () => resolve(session), reject },
        });
      }),
  );

  return writes;
}

const tick = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe("useLiveSession.flush", () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockGetAll.mockReset();
  });

  it("resolves immediately when nothing is pending", async () => {
    const { result } = renderHook(() => useLiveSession(mk(), [], "kg"));

    await expect(result.current.flush()).resolves.toBeUndefined();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("does not resolve until the in-flight save has been written", async () => {
    const writes = controlledSaves();
    const { result } = renderHook(() => useLiveSession(mk(), [], "kg"));

    act(() => {
      result.current.update((current) => ({ ...current, name: "Pull" }));
    });
    await act(tick);

    let flushed = false;
    const flushing = result.current.flush().then(() => {
      flushed = true;
    });

    await act(tick);
    expect(flushed).toBe(false);

    await act(async () => {
      writes[0]?.gate.resolve();
      await flushing;
    });

    expect(flushed).toBe(true);
    expect(writes[0]?.saved.name).toBe("Pull");
  });

  it("waits for saves queued after flush was called, ending on the newest state", async () => {
    const writes = controlledSaves();
    const { result } = renderHook(() => useLiveSession(mk(), [], "kg"));

    act(() => {
      result.current.update((current) => ({ ...current, name: "A" }));
    });
    await act(tick);

    let flushed = false;
    const flushing = result.current.flush().then(() => {
      flushed = true;
    });

    // A newer edit arrives while the first write is still in flight.
    act(() => {
      result.current.update((current) => ({ ...current, name: "B" }));
    });

    await act(async () => {
      writes[0]?.gate.resolve();
      await tick();
    });
    expect(flushed).toBe(false);

    // Let every remaining queued write finish, in order.
    await act(async () => {
      for (let i = 1; i < 5; i += 1) {
        await tick();
        writes[i]?.gate.resolve();
      }
      await flushing;
    });

    expect(flushed).toBe(true);
    expect(writes[writes.length - 1]?.saved.name).toBe("B");
  });

  it("still resolves (and never rejects) when a save fails", async () => {
    const writes = controlledSaves();
    const { result } = renderHook(() => useLiveSession(mk(), [], "kg"));

    act(() => {
      result.current.update((current) => ({ ...current, name: "X" }));
    });
    await act(tick);

    const flushing = result.current.flush();

    await act(async () => {
      writes[0]?.gate.reject(new Error("disk full"));
      await expect(flushing).resolves.toBeUndefined();
    });
  });
});

describe("useForge.actions.resume", () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockGetAll.mockReset();
  });

  it("reads the session from storage, not from the copy it was given", async () => {
    mockGetAll.mockResolvedValue([mk({ name: "Latest from storage" })]);

    const { result } = renderHook(() => useForge());
    let resumed: WorkoutSession | null = null;

    await act(async () => {
      resumed = await result.current.actions.resume("s1");
    });

    expect(mockGetAll).toHaveBeenCalled();
    expect((resumed as WorkoutSession | null)?.name).toBe("Latest from storage");
  });

  it("returns null when the session no longer exists", async () => {
    mockGetAll.mockResolvedValue([]);

    const { result } = renderHook(() => useForge());
    let resumed: WorkoutSession | null = mk();

    await act(async () => {
      resumed = await result.current.actions.resume("gone");
    });

    expect(resumed).toBeNull();
  });
});
