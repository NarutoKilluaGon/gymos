import { createElement } from "react";

import { ForgeSession } from "@/components/workouts/forge-session";
import type { ForgeData } from "@/hooks/use-forge";
import { toggleSet } from "@/services/forge/ops";
import { saveSession, getAllSessions } from "@/storage/repositories/workout-sessions";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";
import { showUndoToast } from "@/utils/toast";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));
jest.mock("@/storage/repositories/workout-sessions", () => ({
  saveSession: jest.fn(),
  getAllSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockGetAll = getAllSessions as jest.MockedFunction<typeof getAllSessions>;

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  toJSON: () => unknown;
  unmount: () => void;
};

const makeSet = (id: string, weight: number, reps: number, completed = false, extra?: Partial<WorkoutSet>): WorkoutSet => ({
  id,
  weight,
  reps,
  completed,
  unit: "kg",
  ...extra,
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

function mount(initial: WorkoutSession, customData?: Partial<ForgeData>) {
  const flushRef: { current: (() => Promise<void>) | null } = { current: null };

  const fullData: ForgeData = {
    sessions: customData?.sessions ?? [],
    settings: {
      plans: [],
      activePlanId: "",
      restSeconds: 90,
      barKg: 20,
      routinesImported: true,
      ...(customData?.settings ?? {}),
    },
    custom: [],
    catalog: [],
    cardio: {},
    bodyweightKg: 75,
    ...customData,
  };

  act(() => {
    mounted = TestRenderer.create(
      createElement(ForgeSession, {
        initial,
        data: fullData,
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

const findByLabel = (renderer: Renderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityLabel === label)[0];

const findAllByLabel = (renderer: Renderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityLabel === label);

beforeEach(() => {
  mockSave.mockReset();
  mockGetAll.mockReset();
  mockSave.mockImplementation(async (session) => session);
  mockGetAll.mockResolvedValue([]);
  (showUndoToast as jest.Mock).mockClear();
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

describe("Forge Session v2 Additions (Part 8)", () => {
  describe("AMRAP superset of pull-ups and dips end to end", () => {
    it("renders bodyweight +KG header, helper text, and F badge for AMRAP sets", async () => {
      const prevSession: WorkoutSession = {
        id: "prev",
        name: "Upper",
        date: "2026-03-01",
        startedAt: "2026-03-01T10:00:00.000Z",
        endedAt: "2026-03-01T11:00:00.000Z",
        exercises: [
          makeExercise("e1", "Pull-ups", [makeSet("ps1", 0, 10, true)], { bodyweight: true }),
          makeExercise("e2", "Dips", [makeSet("ds1", 0, 12, true)], { bodyweight: true }),
        ],
      };

      const liveSession: WorkoutSession = {
        id: "s1",
        name: "Upper Day",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise(
            "e1",
            "Pull-ups",
            [makeSet("p1", 0, 8, false)],
            { bodyweight: true, repTarget: "8+", group: "ss1" },
          ),
          makeExercise(
            "e2",
            "Dips",
            [makeSet("d1", 0, 10, false)],
            { bodyweight: true, repTarget: "AMRAP", group: "ss1" },
          ),
        ],
      };

      const { renderer } = mount(liveSession, { sessions: [prevSession] });
      const tree = JSON.stringify(renderer.toJSON());

      // 1. Column header reads "+KG" for bodyweight
      expect(tree).toContain("+KG");

      // 2. Bodyweight helper under first row
      expect(tree).toContain("Extra load. Use − for assistance.");

      // 3. Ugly sentence is removed
      expect(tree).not.toContain("Bodyweight. The weight box is extra load (minus if assisted).");

      // 4. Sets show "F" badge for AMRAP target
      const failureBadges = findAllByLabel(renderer, "Taken to failure");
      expect(failureBadges.length).toBeGreaterThanOrEqual(2);
      const fTexts = renderer.root.findAll((n) => n.children?.includes("F"));
      expect(fTexts.length).toBeGreaterThanOrEqual(2);

      // 5. Reps placeholder reads "max"
      const repsInputs = renderer.root.findAll(
        (n) => typeof n.props.placeholder === "string" && n.props.placeholder === "max",
      );
      expect(repsInputs.length).toBeGreaterThanOrEqual(2);

      // 6. PREV column shows last time's reps (e.g. "10" for pull-ups, "12" for dips)
      expect(tree).toContain("10");
      expect(tree).toContain("12");
    });

    it("handles superset flow: completing set 1 of leader does not start rest timer; partner set 1 starts it", async () => {
      const now = new Date("2026-03-08T10:15:00.000Z");
      const sessionWithSuperset: WorkoutSession = {
        id: "s1",
        name: "Upper Day",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise(
            "e1",
            "Pull-ups",
            [makeSet("p1", 0, 8, false)],
            { bodyweight: true, repTarget: "8+", group: "ss1" },
          ),
          makeExercise(
            "e2",
            "Dips",
            [makeSet("d1", 0, 10, false)],
            { bodyweight: true, repTarget: "AMRAP", group: "ss1" },
          ),
        ],
      };

      // Ticking leader set 0: startRest MUST BE FALSE
      const leaderResult = toggleSet(sessionWithSuperset, 0, 0, now);
      expect(leaderResult.session.exercises[0].sets[0].completed).toBe(true);
      expect(leaderResult.startRest).toBe(false);

      // Ticking partner set 0: startRest MUST BE TRUE
      const partnerResult = toggleSet(leaderResult.session, 1, 0, now);
      expect(partnerResult.session.exercises[1].sets[0].completed).toBe(true);
      expect(partnerResult.startRest).toBe(true);
    });

    it("highlights partner set when leader set is completed in live UI", async () => {
      const sessionWithLeaderDone: WorkoutSession = {
        id: "s1",
        name: "Upper Day",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise(
            "e1",
            "Pull-ups",
            [makeSet("p1", 0, 12, true)],
            { bodyweight: true, repTarget: "8+", group: "ss1" },
          ),
          makeExercise(
            "e2",
            "Dips",
            [makeSet("d1", 0, 0, false)],
            { bodyweight: true, repTarget: "AMRAP", group: "ss1" },
          ),
        ],
      };

      const { renderer } = mount(sessionWithLeaderDone);

      // ExerciseCard renders the partner set with highlighted border
      const rows = renderer.root.findAll(
        (n) => Array.isArray(n.props.style) && n.props.style.some((st: Record<string, unknown>) => st && st.borderColor === "rgba(217, 164, 65, 0.4)"),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Load types & headers", () => {
    it("renders ASSIST header for assisted load type", async () => {
      const session: WorkoutSession = {
        id: "s1",
        name: "Legs",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise("e1", "Assisted Pull-ups", [makeSet("s1", -20, 8)], { loadType: "assisted" }),
        ],
      };

      const { renderer } = mount(session);
      const tree = JSON.stringify(renderer.toJSON());
      expect(tree).toContain("ASSIST");
    });

    it("renders SEC instead of REPS for timed load type", async () => {
      const session: WorkoutSession = {
        id: "s1",
        name: "Core",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise("e1", "Plank", [makeSet("s1", 0, 60)], { loadType: "timed" }),
        ],
      };

      const { renderer } = mount(session);
      const tree = JSON.stringify(renderer.toJSON());
      expect(tree).toContain("SEC");
    });
  });

  describe("Tappable PREV ghost value", () => {
    it("copies previous weight and reps into current set on tap", async () => {
      const prevSession: WorkoutSession = {
        id: "prev",
        name: "Chest",
        date: "2026-03-01",
        startedAt: "2026-03-01T10:00:00.000Z",
        endedAt: "2026-03-01T11:00:00.000Z",
        exercises: [
          makeExercise("e1", "Bench Press", [makeSet("ps1", 82.5, 8, true)]),
        ],
      };

      const liveSession: WorkoutSession = {
        id: "s1",
        name: "Chest",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise("e1", "Bench Press", [makeSet("s1", 0, 0, false)]),
        ],
      };

      const { renderer, flushRef } = mount(liveSession, { sessions: [prevSession] });

      const prevBtn = findByLabel(renderer, "Copy previous 82.5×8");
      expect(prevBtn).toBeDefined();

      // Tap PREV button
      await act(async () => {
        (prevBtn.props.onPress as () => void)();
      });

      await act(async () => {
        await flushRef.current?.();
      });

      const saved = mockSave.mock.calls[mockSave.mock.calls.length - 1][0] as WorkoutSession;
      expect(saved.exercises[0].sets[0].weight).toBe(82.5);
      expect(saved.exercises[0].sets[0].reps).toBe(8);
    });
  });

  describe("Undo for set removal in live session", () => {
    it("triggers undo toast and restores set upon undo", async () => {
      const liveSession: WorkoutSession = {
        id: "s1",
        name: "Arms",
        date: "2026-03-08",
        startedAt: "2026-03-08T10:00:00.000Z",
        exercises: [
          makeExercise("e1", "Curls", [
            makeSet("s1", 15, 10, true),
            makeSet("s2", 17.5, 8, false),
          ]),
        ],
      };

      const { renderer, flushRef } = mount(liveSession);

      // Long-press badge of set 1 to remove it
      const badge = findByLabel(renderer, "Tap to mark as warm-up");
      expect(badge).toBeDefined();

      await act(async () => {
        (badge.props.onLongPress as () => void)();
      });

      expect(showUndoToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Set removed",
          onUndo: expect.any(Function),
        }),
      );

      // Call onUndo
      const undoCall = (showUndoToast as jest.Mock).mock.calls[0][0];
      await act(async () => {
        undoCall.onUndo();
      });

      await act(async () => {
        await flushRef.current?.();
      });

      const saved = mockSave.mock.calls[mockSave.mock.calls.length - 1][0] as WorkoutSession;
      expect(saved.exercises[0].sets).toHaveLength(2);
      expect(saved.exercises[0].sets[0].id).toBe("s1");
    });
  });
});
