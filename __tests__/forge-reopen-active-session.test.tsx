import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import { ForgeSession } from "@/components/workouts/forge-session";
import type { ForgeData } from "@/hooks/use-forge";
import {
  getActiveSession,
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
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// The real repository over the AsyncStorage mock, with the calls observable.
jest.mock("@/storage/repositories/workout-sessions", () => {
  const actual = jest.requireActual("@/storage/repositories/workout-sessions");

  return {
    ...actual,
    saveSession: jest.fn(actual.saveSession),
    getActiveSession: jest.fn(actual.getActiveSession),
  };
});

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  ExercisePickerSheet: () => null,
  NoteSheet: () => null,
  PlatesSheet: () => null,
  SummarySheet: () => null,
  FinishSheet: () => null,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockActive = getActiveSession as jest.MockedFunction<typeof getActiveSession>;
const mockToast = showToast as jest.MockedFunction<typeof showToast>;

const BLOCKED = "Finish or delete your current workout first";

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  unmount: () => void;
};

const bench = (id: string) => [
  {
    id: `${id}-e`,
    exerciseId: "ex-bench",
    name: "Bench",
    sets: [{ id: `${id}-s`, weight: 60, reps: 5, completed: true, unit: "kg" as const }],
  },
];

const finished = (id: string, date: string): WorkoutSession => ({
  id,
  name: id,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  date,
  exercises: bench(id),
});

const unfinished = (id: string, date: string): WorkoutSession => {
  const { endedAt: _ended, ...rest } = finished(id, date);

  return rest;
};

const data: ForgeData = {
  sessions: [],
  settings: { plans: [], activePlanId: "", restSeconds: 0, barKg: 20, routinesImported: true },
  custom: [],
  catalog: [],
  cardio: {},
  bodyweightKg: undefined,
};

let mounted: Renderer | undefined;
let onChanged: jest.Mock;

function mount(initial: WorkoutSession) {
  onChanged = jest.fn();

  act(() => {
    mounted = TestRenderer.create(
      createElement(ForgeSession, {
        initial,
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

  return mounted as Renderer;
}

const hasText = (renderer: Renderer, text: string) =>
  renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === text).length > 0;

/** Press whatever owns the Text with this content. */
const pressText = (renderer: Renderer, text: string) => {
  const node = renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === text)[0];
  let owner: Node | null = node ?? null;

  while (owner && typeof owner.props.onPress !== "function") owner = owner.parent;

  if (!owner) throw new Error(`No pressable for "${text}"`);

  return act(() => (owner!.props.onPress as () => void)());
};

const settle = async () => {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });
  }
};

const stored = async (id: string) => (await getAllSessions()).find((s) => s.id === id);
const unfinishedIds = async () =>
  (await getAllSessions()).filter((s) => !s.endedAt).map((s) => s.id);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSave.mockClear();
  mockActive.mockClear();
  mockToast.mockClear();
});

afterEach(async () => {
  await act(() => mounted?.unmount());
  mounted = undefined;
});

describe("Reopen keeps at most one unfinished workout", () => {
  it("is blocked while another workout is unfinished", async () => {
    const a = finished("A", "2026-03-01");
    const b = unfinished("B", "2026-03-02");

    await saveSession(a);
    await saveSession(b);
    mockSave.mockClear();

    const renderer = mount(a);

    await pressText(renderer, "Reopen");
    await settle();

    // Told the user why.
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(BLOCKED);
    // Nothing was written: no reopen save, no reload.
    expect(mockSave).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    // A stays finished, and B is still the only unfinished session.
    expect((await stored("A"))?.endedAt).toBe(a.endedAt);
    expect(await unfinishedIds()).toEqual(["B"]);
    // The screen still shows the finished session.
    expect(hasText(renderer, "Reopen")).toBe(true);
    expect(hasText(renderer, "Finish")).toBe(false);
  });

  it("is allowed when nothing else is unfinished", async () => {
    const a = finished("A", "2026-03-01");

    await saveSession(a);
    mockSave.mockClear();

    const renderer = mount(a);

    await pressText(renderer, "Reopen");
    await settle();

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect((await stored("A"))?.endedAt).toBeUndefined();
    expect(await unfinishedIds()).toEqual(["A"]);
    // Same as before the guard: reopen never reloaded the parent.
    expect(onChanged).not.toHaveBeenCalled();
    expect(hasText(renderer, "Finish")).toBe(true);
    expect(hasText(renderer, "Reopen")).toBe(false);
  });

  it("is allowed when the session being reopened is itself the stored unfinished one", async () => {
    // Its finish hasn't reached storage yet, so storage still says unfinished.
    await saveSession(unfinished("A", "2026-03-01"));
    mockSave.mockClear();

    const renderer = mount(finished("A", "2026-03-01"));

    await pressText(renderer, "Reopen");
    await settle();

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(await unfinishedIds()).toEqual(["A"]);
  });

  it("does not reopen when it can't check for a running workout", async () => {
    const a = finished("A", "2026-03-01");

    await saveSession(a);
    mockSave.mockClear();
    mockActive.mockRejectedValueOnce(new Error("storage unavailable"));

    const renderer = mount(a);

    await pressText(renderer, "Reopen");
    await settle();

    expect(mockToast).toHaveBeenCalledWith("Couldn't reopen workout");
    expect(mockSave).not.toHaveBeenCalled();
    expect((await stored("A"))?.endedAt).toBe(a.endedAt);
  });

  it("does not reopen after the screen was left during the check", async () => {
    const a = finished("A", "2026-03-01");

    await saveSession(a);
    mockSave.mockClear();

    let release: (value: WorkoutSession | null) => void = () => undefined;

    mockActive.mockImplementationOnce(
      () => new Promise<WorkoutSession | null>((resolve) => { release = resolve; }),
    );

    const renderer = mount(a);

    await pressText(renderer, "Reopen");
    await act(() => renderer.unmount());
    mounted = undefined;
    await act(async () => release(null));
    await settle();

    expect(mockSave).not.toHaveBeenCalled();
    expect((await stored("A"))?.endedAt).toBe(a.endedAt);
  });

  it("a double tap reopens once", async () => {
    const a = finished("A", "2026-03-01");

    await saveSession(a);
    mockSave.mockClear();

    // Both taps land before either check has finished.
    const releases: ((value: WorkoutSession | null) => void)[] = [];
    const pending = () =>
      new Promise<WorkoutSession | null>((resolve) => { releases.push(resolve); });

    mockActive.mockImplementationOnce(pending).mockImplementationOnce(pending);

    const renderer = mount(a);

    await pressText(renderer, "Reopen");
    await pressText(renderer, "Reopen");
    await act(async () => releases.forEach((release) => release(null)));
    await settle();

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
    expect(await unfinishedIds()).toEqual(["A"]);
  });
});
