import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import { useLiveSession } from "@/hooks/use-forge";
import { getAllPRs } from "@/storage/repositories/prs";
import { getAllSessions, saveSession } from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

const lift = (sid: string, date: string, weight: number, ended: boolean): WorkoutSession => ({
  id: sid,
  name: sid,
  startedAt: `${date}T10:00:00.000Z`,
  ...(ended ? { endedAt: `${date}T11:00:00.000Z` } : {}),
  date,
  exercises: [
    {
      id: `${sid}-ex`,
      exerciseId: "bench",
      name: "Bench",
      sets: [{ id: `${sid}-set`, weight, reps: 5, unit: "kg", completed: true }],
    },
  ],
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("finishing a workout", () => {
  it("is judged against stored history even when the screen's list is stale", async () => {
    await saveSession(lift("earlier", "2026-01-01", 100, true));

    // The screen still holds an empty list (e.g. loaded before that session saved).
    const { result } = renderHook(() =>
      useLiveSession(lift("today", "2026-01-08", 105, false), [], "kg"),
    );
    let finished: WorkoutSession | undefined;

    await act(async () => {
      finished = (await result.current.complete(new Date("2026-01-08T11:00:00.000Z"))).session;
    });

    expect(finished?.prs?.map((pr) => pr.exerciseId)).toEqual(["bench"]);
    expect((await getAllSessions()).find((s) => s.id === "today")?.prs).toHaveLength(1);
  });

  it("stores the first-ever performance as a record without flagging it", async () => {
    const { result } = renderHook(() =>
      useLiveSession(lift("first", "2026-01-08", 100, false), [], "kg"),
    );

    await act(async () => {
      await result.current.complete(new Date("2026-01-08T11:00:00.000Z"));
    });

    expect((await getAllPRs()).bench).toMatchObject({ weight: 100, reps: 5 });
    expect((await getAllSessions())[0]?.prs).toEqual([]);
  });

  it("keeps edits made while it was reading history", async () => {
    await saveSession(lift("earlier", "2026-01-01", 100, true));

    const { result } = renderHook(() =>
      useLiveSession(lift("today", "2026-01-08", 90, false), [], "kg"),
    );

    await act(async () => {
      const finishing = result.current.complete(new Date("2026-01-08T11:00:00.000Z"));

      result.current.update((current) => ({ ...current, name: "Edited during finish" }));
      await finishing;
    });

    expect((await getAllSessions()).find((s) => s.id === "today")?.name).toBe("Edited during finish");
  });
});
