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

beforeEach(() => {
  mockSave.mockReset();
  mockGetAll.mockReset();
  mockToast.mockReset();
  mockGetAll.mockResolvedValue([]);
  sheets.onFinish = undefined;
  sheets.summaryVisible = false;
});

describe("ForgeSession Finish double tap", () => {
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

  const finishedSaves = () =>
    mockSave.mock.calls.filter(([session]) => session.endedAt !== undefined);

  it("finishes once when Finish fires twice before the save completes", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    mockSave.mockImplementation(async (session) => {
      await held;

      return session;
    });

    const { onChanged } = mount();

    await act(async () => {
      sheets.onFinish?.("keep");
      sheets.onFinish?.("complete");
      sheets.onFinish?.("keep");
    });
    await act(async () => {
      release();
      await held;
    });

    expect(finishedSaves()).toHaveLength(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(sheets.summaryVisible).toBe(true);
  });

  it("can be finished again after the first attempt failed to save", async () => {
    mockSave.mockRejectedValueOnce(new Error("disk full"));
    mockSave.mockImplementation(async (session) => session);

    const { onChanged } = mount();

    await act(async () => {
      sheets.onFinish?.("keep");
    });

    expect(sheets.summaryVisible).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();

    await act(async () => {
      sheets.onFinish?.("keep");
    });

    expect(sheets.summaryVisible).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
