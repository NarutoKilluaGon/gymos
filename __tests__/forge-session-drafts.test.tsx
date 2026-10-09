import { createElement } from "react";

import { ForgeSession } from "@/components/workouts/forge-session";
import type { ForgeData } from "@/hooks/use-forge";
import { getAllSessions, saveSession } from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));
jest.mock("@/storage/repositories/workout-sessions", () => ({
  saveSession: jest.fn(),
  getAllSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

const mockSheets: { onFinish?: (mode: "keep" | "complete" | "drop") => void } = {};

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  ExercisePickerSheet: () => null,
  NoteSheet: () => null,
  PlatesSheet: () => null,
  SummarySheet: () => null,
  FinishSheet: (props: { onFinish: (mode: "keep" | "complete" | "drop") => void }) => {
    mockSheets.onFinish = props.onFinish;

    return null;
  },
  ExerciseMenuSheet: (props: {
    visible: boolean;
    onRemove: () => void;
  }) => {
    if (!props.visible) return null;
    const { createElement } = require("react");
    const { Pressable, Text } = require("react-native");
    return createElement(
      Pressable,
      { onPress: props.onRemove },
      createElement(Text, null, "Remove"),
    );
  },
  WorkoutMenuSheet: () => null,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockGetAll = getAllSessions as jest.MockedFunction<typeof getAllSessions>;

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  unmount: () => void;
};

const set = (id: string, weight: number, reps: number, completed = true) => ({
  id, weight, reps, completed, unit: "kg" as const,
});

const exercise = (id: string, sets: ReturnType<typeof set>[]) => ({
  id, exerciseId: `ex-${id}`, name: `Lift ${id}`, sets,
});

const history: WorkoutSession = {
  id: "old",
  name: "Old",
  startedAt: "2026-02-01T10:00:00.000Z",
  endedAt: "2026-02-01T11:00:00.000Z",
  date: "2026-02-01",
  exercises: [exercise("e1", [set("o1", 50, 5)])],
};

const current = (exercises: WorkoutSession["exercises"]): WorkoutSession => ({
  id: "now",
  name: "Push",
  startedAt: "2026-03-01T10:00:00.000Z",
  date: "2026-03-01",
  exercises,
});

const data: ForgeData = {
  sessions: [history],
  settings: { plans: [], activePlanId: "", restSeconds: 0, barKg: 20, routinesImported: true },
  custom: [],
  catalog: [],
  cardio: {},
  bodyweightKg: undefined,
};

let mounted: Renderer | undefined;

function mount(initial: WorkoutSession) {
  const flushRef: { current: (() => Promise<void>) | null } = { current: null };

  act(() => {
    mounted = TestRenderer.create(
      createElement(ForgeSession, {
        initial,
        data,
        unit: "kg",
        onClose: jest.fn(),
        onDelete: jest.fn(async () => true),
        onCreateExercise: jest.fn(async () => null),
        onChanged: jest.fn(),
        flushRef,
      }),
    );
  });

  return { renderer: mounted as Renderer, flushRef };
}

const type = (renderer: Renderer, label: string, text: string) => {
  const found = renderer.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === "function",
  )[0];

  if (!found) throw new Error(`No field "${label}"`);

  return act(() => (found.props.onChangeText as (t: string) => void)(text));
};

/** Press whatever owns the Text with this content (e.g. an Action). */
const pressText = (renderer: Renderer, text: string, index = 0) => {
  const node = renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === text)[index];
  let owner: Node | null = node ?? null;

  while (owner && typeof owner.props.onPress !== "function") owner = owner.parent;

  if (!owner) throw new Error(`No pressable for "${text}"`);

  return act(() => (owner!.props.onPress as () => void)());
};

const savedSessions = () => mockSave.mock.calls.map((call) => call[0] as WorkoutSession);
const lastSaved = () => savedSessions()[savedSessions().length - 1];

beforeEach(() => {
  mockSave.mockReset();
  mockGetAll.mockReset();
  mockSave.mockImplementation(async (session) => session);
  mockGetAll.mockResolvedValue([history]);
  mockSheets.onFinish = undefined;
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

describe("ForgeSession pending numeric drafts", () => {
  it("Finish: typed weight/reps are in the persisted session", async () => {
    const { renderer } = mount(current([exercise("e1", [set("a", 50, 5, false)])]));

    await type(renderer, "Set 1 weight", "62.5");
    await type(renderer, "Set 1 reps", "6");

    await act(async () => {
      mockSheets.onFinish?.("complete");
    });
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    const saved = lastSaved();

    expect(saved?.endedAt).toBeDefined();
    expect(saved?.exercises[0]?.sets[0]).toMatchObject({ weight: 62.5, reps: 6, completed: true });
  });

  it("Finish: PR detection and volume use the typed value", async () => {
    const { renderer } = mount(current([exercise("e1", [set("a", 50, 5, true)])]));

    await type(renderer, "Set 1 weight", "60");

    await act(async () => {
      mockSheets.onFinish?.("keep");
    });
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    const saved = lastSaved();

    expect(saved?.prs).toEqual([{ exerciseId: "ex-e1", weight: 60, reps: 5, unit: "kg" }]);
    // The session's volume, as the History/Today screens compute it, is 60 × 5.
    const { sessionVolumeKg } = require("@/services/forge/load");

    expect(sessionVolumeKg(saved)).toBe(300);
  });

  it("Back/close: the flush the parent awaits commits typed values first", async () => {
    const { renderer, flushRef } = mount(current([exercise("e1", [set("a", 50, 5, false)])]));

    await type(renderer, "Set 1 weight", "80");
    await type(renderer, "Set 1 reps", "3");
    expect(mockSave).not.toHaveBeenCalled();

    // forge-app's closeSession awaits exactly this before unmounting.
    await act(async () => {
      await flushRef.current?.();
    });

    expect(lastSaved()?.exercises[0]?.sets[0]).toMatchObject({ weight: 80, reps: 3 });
  });

  it("does not persist twice when the field blurs after the flush", async () => {
    const { renderer, flushRef } = mount(current([exercise("e1", [set("a", 50, 5, false)])]));

    await type(renderer, "Set 1 weight", "70");
    await act(async () => {
      await flushRef.current?.();
    });

    const writes = mockSave.mock.calls.length;
    const input = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === "Set 1 weight" && typeof n.props.onBlur === "function",
    )[0];

    await act(async () => (input?.props.onBlur as () => void)());
    expect(mockSave.mock.calls.length).toBe(writes);
  });

  it("removing a focused set never writes its draft into another set", async () => {
    const { renderer, flushRef } = mount(
      current([exercise("e1", [set("a", 50, 5, false), set("b", 55, 5, false)])]),
    );

    await type(renderer, "Set 1 weight", "99");
    // Long-press the first set's number badge: removeSet.
    const badge = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === "Tap to mark as warm-up",
    )[0];

    await act(async () => (badge?.props.onLongPress as () => void)());
    await act(async () => {
      await flushRef.current?.();
    });

    const sets = lastSaved()?.exercises[0]?.sets;

    expect(sets).toHaveLength(1);
    expect(sets?.[0]).toMatchObject({ id: "b", weight: 55 });
    expect(savedSessions().some((s) => s.exercises.some((e) => e.sets.some((x) => x.weight === 99)))).toBe(false);
  });

  it("removing a focused exercise never writes its draft into another exercise", async () => {
    const { renderer, flushRef } = mount(
      current([exercise("e1", [set("a", 50, 5, false)]), exercise("e2", [set("b", 70, 8, false)])]),
    );

    await type(renderer, "Set 1 weight", "99"); // first match: Lift e1
    await pressText(renderer, "⋯", 0);
    await pressText(renderer, "Remove", 0);
    await act(async () => {
      await flushRef.current?.();
    });

    const exercises = lastSaved()?.exercises;

    expect(exercises).toHaveLength(1);
    expect(exercises?.[0]?.id).toBe("e2");
    expect(exercises?.[0]?.sets[0]).toMatchObject({ weight: 70, reps: 8 });
  });
});
