import { createElement } from "react";

import { ForgeSession } from "@/components/workouts/forge-session";
import { useLiveSession, type ForgeData } from "@/hooks/use-forge";
import {
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";
import { showToast } from "@/utils/toast";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn() }));
jest.mock("@/storage/repositories/workout-sessions", () => ({
  saveSession: jest.fn(),
  getAllSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

// Capture what the screen hands to the sheets: `visible` on the summary is
// the "Workout done" success state.
const sheets: {
  onFinish?: (mode: "keep" | "complete" | "drop") => void;
  summaryVisible: boolean;
} = { summaryVisible: false };

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  ExercisePickerSheet: () => null,
  NoteSheet: () => null,
  PlatesSheet: () => null,
  SummarySheet: (props: { visible: boolean }) => {
    sheets.summaryVisible = props.visible;

    return null;
  },
  FinishSheet: (props: {
    onFinish: (mode: "keep" | "complete" | "drop") => void;
  }) => {
    sheets.onFinish = props.onFinish;

    return null;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockGetAll = getAllSessions as jest.MockedFunction<typeof getAllSessions>;
const mockToast = showToast as jest.MockedFunction<typeof showToast>;

const open = (): WorkoutSession => ({
  id: "now",
  name: "Push",
  startedAt: "2026-03-01T10:00:00.000Z",
  date: "2026-03-01",
  exercises: [
    {
      id: "e1",
      exerciseId: "ex-e1",
      name: "Bench",
      sets: [
        { id: "s1", weight: 60, reps: 5, completed: true, unit: "kg" },
      ],
    },
  ],
});

const data: ForgeData = {
  sessions: [],
  settings: {
    plans: [],
    activePlanId: "",
    restSeconds: 0,
    barKg: 20,
    routinesImported: true,
  },
  custom: [],
  catalog: [],
  cardio: {},
  bodyweightKg: undefined,
};

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

beforeEach(() => {
  mockSave.mockReset();
  mockGetAll.mockReset();
  mockToast.mockReset();
  mockGetAll.mockResolvedValue([]);
  sheets.onFinish = undefined;
  sheets.summaryVisible = false;
});

describe("useLiveSession.complete", () => {
  it("resolves with the finished session when the save succeeds", async () => {
    mockSave.mockImplementation(async (session) => session);

    const { result } = renderHook(() => useLiveSession(open(), [], "kg"));
    let outcome: Awaited<ReturnType<typeof result.current.complete>> | undefined;

    await act(async () => {
      outcome = await result.current.complete(new Date("2026-03-01T11:00:00Z"));
    });

    expect(outcome?.session.endedAt).toBeDefined();
    expect(mockSave).toHaveBeenCalled();
    expect(mockSave.mock.calls.at(-1)?.[0].endedAt).toBeDefined();
    expect(result.current.session.endedAt).toBeDefined();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("rejects, restores the open session and toasts when the save fails", async () => {
    mockSave.mockRejectedValue(new Error("disk full"));

    const { result } = renderHook(() => useLiveSession(open(), [], "kg"));
    let failure: unknown;

    await act(async () => {
      try {
        await result.current.complete(new Date("2026-03-01T11:00:00Z"));
      } catch (error) {
        failure = error;
      }
    });

    expect((failure as Error).message).toBe("disk full");
    // Not shown as finished: the clock is still running.
    expect(result.current.session.endedAt).toBeUndefined();
    expect(mockToast).toHaveBeenCalledWith("Couldn't save workout");
  });

  it("can be retried after a failed save", async () => {
    mockSave.mockRejectedValueOnce(new Error("disk full"));
    mockSave.mockImplementation(async (session) => session);

    const { result } = renderHook(() => useLiveSession(open(), [], "kg"));
    let second: Awaited<ReturnType<typeof result.current.complete>> | undefined;

    await act(async () => {
      await result.current.complete().catch(() => undefined);
    });
    await act(async () => {
      second = await result.current.complete();
    });

    expect(second?.session.endedAt).toBeDefined();
    expect(result.current.session.endedAt).toBeDefined();
  });

  it("keeps flush resolving (never rejecting) after a failed complete", async () => {
    mockSave.mockRejectedValue(new Error("disk full"));

    const { result } = renderHook(() => useLiveSession(open(), [], "kg"));

    await act(async () => {
      await result.current.complete().catch(() => undefined);
    });

    await expect(result.current.flush()).resolves.toBeUndefined();
  });
});

describe("ForgeSession Complete", () => {
  let mounted: { unmount: () => void } | undefined;

  afterEach(() => {
    act(() => mounted?.unmount());
    mounted = undefined;
  });

  function mount() {
    const onChanged = jest.fn();

    act(() => {
      mounted = TestRenderer.create(
        createElement(ForgeSession, {
          initial: open(),
          data,
          unit: "kg",
          onClose: jest.fn(),
          onDelete: jest.fn(async () => true),
          onCreateExercise: jest.fn(async () => null),
          onChanged,
          flushRef: { current: null },
        }),
      );
    });

    return { onChanged };
  }

  it("shows the summary and reloads when the save succeeds", async () => {
    mockSave.mockImplementation(async (session) => session);

    const { onChanged } = mount();

    await act(async () => {
      sheets.onFinish?.("keep");
    });

    expect(sheets.summaryVisible).toBe(true);
    expect(onChanged).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("does NOT show the summary or report success when the save fails", async () => {
    mockSave.mockRejectedValue(new Error("disk full"));

    const { onChanged } = mount();

    await act(async () => {
      sheets.onFinish?.("keep");
    });

    expect(sheets.summaryVisible).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Couldn't save workout");
  });
});
