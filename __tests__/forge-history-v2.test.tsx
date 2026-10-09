import { createElement } from "react";

import { HistoryView } from "@/components/workouts/forge-history";
import type { ForgeData } from "@/hooks/use-forge";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";
import { showUndoToast } from "@/utils/toast";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  toJSON: () => unknown;
  unmount: () => void;
};

const makeSet = (id: string, weight: number, reps: number, completed = true): WorkoutSet => ({
  id,
  weight,
  reps,
  completed,
  unit: "kg",
});

const makeExercise = (
  id: string,
  name: string,
  sets: WorkoutSet[],
  extra?: Partial<WorkoutExercise>,
): WorkoutExercise => ({
  id,
  exerciseId: `ex-${id}`,
  name,
  sets,
  ...extra,
});

let mounted: Renderer | undefined;

function mount(data: ForgeData, onOpen = jest.fn(), onDelete = jest.fn(async () => true), onRestore = jest.fn(async () => true)) {
  act(() => {
    mounted = TestRenderer.create(
      createElement(HistoryView, {
        data,
        unit: "kg",
        onOpen,
        onDelete,
        onRestore,
      }),
    );
  });

  return { renderer: mounted as Renderer, onOpen, onDelete, onRestore };
}

const findByLabel = (renderer: Renderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityLabel === label)[0];

const pressText = (renderer: Renderer, text: string) => {
  const found = renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === text)[0];
  let node: Node | null = found ?? null;
  while (node && typeof node.props.onPress !== "function") node = node.parent;
  if (!node) throw new Error(`No pressable for "${text}"`);
  return act(async () => {
    (node!.props.onPress as () => void)();
  });
};

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
  (showUndoToast as jest.Mock).mockClear();
});

describe("Forge History v2 (Part 9)", () => {
  const session1: WorkoutSession = {
    id: "s1",
    name: "Push Power",
    date: "2026-10-08",
    startedAt: "2026-10-08T10:00:00.000Z",
    endedAt: "2026-10-08T11:00:00.000Z",
    exercises: [
      makeExercise("e1", "Bench Press", [makeSet("st1", 80, 8), makeSet("st2", 85, 5)], {
        group: undefined,
      }),
    ],
    prs: [{ exerciseId: "ex-e1", weight: 85, reps: 5, unit: "kg" }],
  };

  const session2: WorkoutSession = {
    id: "s2",
    name: "Leg Day",
    date: "2026-10-05",
    startedAt: "2026-10-05T09:00:00.000Z",
    endedAt: "2026-10-05T10:15:00.000Z",
    exercises: [
      makeExercise("e2", "Back Squat", [makeSet("sq1", 120, 5), makeSet("sq2", 120, 5)]),
    ],
  };

  const mockData: ForgeData = {
    sessions: [session1, session2],
    settings: {
      plans: [],
      activePlanId: "",
      restSeconds: 90,
      barKg: 20,
      routinesImported: true,
    },
    custom: [],
    catalog: [
      { id: "ex-e1", name: "Bench Press", muscleGroup: "Chest", primaryMuscles: ["Mid Chest"], bodyweight: false },
      { id: "ex-e2", name: "Back Squat", muscleGroup: "Legs", primaryMuscles: ["Quads", "Glutes"], bodyweight: false },
    ],
    cardio: {},
    bodyweightKg: undefined,
  };

  it("renders summary hero strip with this week's workout count and volume", async () => {
    const { renderer } = mount(mockData);
    const tree = JSON.stringify(renderer.toJSON());

    // Contains THIS WEEK eyebrow
    expect(tree).toContain("THIS WEEK");
    // Displays workout count
    expect(tree).toContain("2 workouts");
  });

  it("renders muscle balance with plural-correct sets and expands for drill-down", async () => {
    const { renderer } = mount(mockData);
    const tree = JSON.stringify(renderer.toJSON());

    // Contains Muscle balance
    expect(tree).toContain("Muscle balance");

    // Check row for Chest
    const chestRow = findByLabel(renderer, "Chest: 2 sets. Tap to toggle breakdown");
    expect(chestRow).toBeDefined();

    // Tap to expand drill-down
    await act(async () => {
      (chestRow.props.onPress as () => void)();
    });

    const expandedTree = JSON.stringify(renderer.toJSON());
    expect(expandedTree).toContain("Mid Chest");
  });

  it("renders personal records feed and tapping a PR opens the workout", async () => {
    const onOpen = jest.fn();
    const { renderer } = mount(mockData, onOpen);

    const prBtn = findByLabel(renderer, "PR: Bench Press 85 kg for 5 reps");
    expect(prBtn).toBeDefined();

    await act(async () => {
      (prBtn.props.onPress as () => void)();
    });

    expect(onOpen).toHaveBeenCalledWith(session1);
  });

  it("renders workouts list grouped by week, tapping row opens session, and delete shows undo toast", async () => {
    const onOpen = jest.fn();
    const onDelete = jest.fn(async () => true);
    const onRestore = jest.fn(async () => true);
    const { renderer } = mount(mockData, onOpen, onDelete, onRestore);

    // Tap to open workout
    const workoutRow = findByLabel(renderer, "View workout Push Power");
    expect(workoutRow).toBeDefined();

    await act(async () => {
      (workoutRow.props.onPress as () => void)();
    });
    expect(onOpen).toHaveBeenCalledWith(session1);

    // Delete workout button
    const deleteBtn = findByLabel(renderer, "Delete Push Power");
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      (deleteBtn.props.onPress as () => void)();
    });

    expect(onDelete).toHaveBeenCalledWith("s1");
    expect(showUndoToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Push Power deleted",
        onUndo: expect.any(Function),
      }),
    );
  });

  it("switches to Grid view, displays sticky exercise column, sessions, and highlighted PRs", async () => {
    const onOpen = jest.fn();
    const { renderer } = mount(mockData, onOpen);

    // Switch to Grid tab
    await pressText(renderer, "Grid");

    const gridTree = JSON.stringify(renderer.toJSON());
    expect(gridTree).toContain("EXERCISE");
    expect(gridTree).toContain("Best set by workout");
    expect(gridTree).toContain("Bench Press");
    expect(gridTree).toContain("Back Squat");

    // PR cell has accessibilityLabel with (PR)
    const prCell = renderer.root.findAll(
      (n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes("(PR)"),
    )[0];
    expect(prCell).toBeDefined();

    // Tap cell to open session
    await act(async () => {
      (prCell.props.onPress as () => void)();
    });
    expect(onOpen).toHaveBeenCalledWith(session1);
  });
});
