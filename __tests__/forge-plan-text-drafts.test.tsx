import { createElement } from "react";

import { PlanView } from "@/components/workouts/forge-plan";
import {
  createDraftRegistry,
  DraftScope,
  DraftTextField,
} from "@/components/workouts/forge-session";
import type { ForgeData } from "@/hooks/use-forge";
import type { ForgeSettings, Plan } from "@/types/forge";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// Same isolation the other Forge suites use (forge-number-field).
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn() }));

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  ExercisePickerSheet: () => null,
  NewPlanSheet: () => null,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => void = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Record<string, (...args: unknown[]) => unknown>;
type Renderer = {
  root: {
    findAll: (
      p: (n: { props: Record<string, unknown> }) => boolean,
    ) => { props: Props & Record<string, unknown> }[];
  };
  unmount: () => void;
};

const field = (renderer: Renderer, label: string) => {
  const found = renderer.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === "function",
  )[0];

  if (!found) throw new Error(`No field "${label}"`);

  return found.props;
};

const type = (renderer: Renderer, label: string, text: string) =>
  act(() => field(renderer, label).onChangeText?.(text));

/** The text the input currently shows. */
const shown = (renderer: Renderer, label: string) => field(renderer, label).value;

describe("DraftTextField", () => {
  function mount(value = "8-10") {
    const registry = createDraftRegistry();
    const onCommit = jest.fn();
    let renderer!: Renderer;

    act(() => {
      renderer = TestRenderer.create(
        createElement(
          DraftScope,
          { value: registry },
          createElement(DraftTextField, { accessibilityLabel: "f", value, onCommit }),
        ),
      );
    });

    return { registry, onCommit, renderer };
  }

  it("commits a typed draft when explicitly flushed, before any unmount", () => {
    const { registry, onCommit, renderer } = mount();

    type(renderer, "f", "5x5");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => registry.flushAll());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("5x5");
  });

  it("commits a pending draft on unmount (a focused field is destroyed without a blur)", () => {
    const { onCommit, renderer } = mount();

    type(renderer, "f", "3x12");
    act(() => renderer.unmount());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("3x12");
  });

  it("commits exactly once across blur, endEditing, flush and unmount", () => {
    const { registry, onCommit, renderer } = mount();

    type(renderer, "f", "6-8");
    act(() => field(renderer, "f").onBlur?.());
    act(() => field(renderer, "f").onEndEditing?.());
    act(() => registry.flushAll());
    act(() => renderer.unmount());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("6-8");
  });

  it("commits again for a second, separate edit", () => {
    const { onCommit, renderer } = mount();

    type(renderer, "f", "a");
    act(() => field(renderer, "f").onBlur?.());
    type(renderer, "f", "b");
    act(() => field(renderer, "f").onBlur?.());

    expect(onCommit.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("commits nothing when nothing was typed", () => {
    const { registry, onCommit, renderer } = mount();

    act(() => field(renderer, "f").onBlur?.());
    act(() => field(renderer, "f").onEndEditing?.());
    act(() => registry.flushAll());
    act(() => renderer.unmount());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the stored value, then the draft while typing, then the stored value again", () => {
    const { renderer } = mount("8-10");

    expect(shown(renderer, "f")).toBe("8-10");

    type(renderer, "f", "5x");
    expect(shown(renderer, "f")).toBe("5x");

    act(() => field(renderer, "f").onBlur?.());
    expect(shown(renderer, "f")).toBe("8-10");
  });

  it("an emptied field is a draft too and commits the empty text", () => {
    const { registry, onCommit, renderer } = mount("8-10");

    type(renderer, "f", "");
    expect(shown(renderer, "f")).toBe("");

    act(() => registry.flushAll());

    expect(onCommit).toHaveBeenCalledWith("");
  });
});

describe("Plan text fields", () => {
  type Row = { id: string; reps?: string };

  const plan = (rows: Row[], extra: Partial<Plan> = {}): Plan => ({
    id: "p1",
    name: "Plan",
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: rows.map((entry) => ({
          exerciseId: entry.id,
          name: entry.id,
          sets: 3,
          reps: entry.reps ?? "8-10",
          weight: 0,
        })),
      },
    ],
    schedule: {},
    rotate: false,
    deload: false,
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...extra,
  });

  const settingsWith = (current: Plan): ForgeSettings => ({
    plans: [current],
    activePlanId: "p1",
    restSeconds: 90,
    barKg: 20,
    routinesImported: true,
  });

  function mountPlan(settings: ForgeSettings) {
    const drafts = createDraftRegistry();
    const changes: ((current: ForgeSettings) => ForgeSettings)[] = [];
    const data: ForgeData = {
      sessions: [],
      settings,
      custom: [],
      catalog: [],
      cardio: {},
      bodyweightKg: undefined,
    };
    let renderer!: Renderer;

    act(() => {
      renderer = TestRenderer.create(
        createElement(PlanView, {
          data,
          unit: "kg",
          drafts,
          onSave: async (change: (current: ForgeSettings) => ForgeSettings) => {
            changes.push(change);

            return true;
          },
          onCreateExercise: async () => null,
        }),
      );
    });

    return { drafts, changes, renderer };
  }

  const apply = (changes: ((c: ForgeSettings) => ForgeSettings)[], base: ForgeSettings) =>
    changes.reduce((current, change) => change(current), base);

  const exercises = (settings: ForgeSettings) => settings.plans[0]?.days[0]?.exercises;

  it("persists typed reps, day name and plan name when the tab is left (flush, then unmount)", () => {
    const base = settingsWith(plan([{ id: "bench" }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "5x5");
    type(renderer, "Day name", "Heavy push");
    type(renderer, "Plan name", "Strength");
    act(() => drafts.flushAll());
    act(() => renderer.unmount());

    const saved = apply(changes, base).plans[0];

    expect(saved?.days[0]?.exercises[0]?.reps).toBe("5x5");
    expect(saved?.days[0]?.name).toBe("Heavy push");
    expect(saved?.name).toBe("Strength");
    expect(changes).toHaveLength(3);
  });

  it("persists typed text on unmount alone, with no blur and no flush", () => {
    const base = settingsWith(plan([{ id: "bench" }]));
    const { changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "4x6");
    act(() => renderer.unmount());

    expect(exercises(apply(changes, base))?.[0]?.reps).toBe("4x6");
    expect(changes).toHaveLength(1);
  });

  it("saves a typed value once across blur, endEditing, flush and unmount", () => {
    const base = settingsWith(plan([{ id: "bench" }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "6-8");
    act(() => field(renderer, "bench reps").onBlur?.());
    act(() => field(renderer, "bench reps").onEndEditing?.());
    act(() => drafts.flushAll());
    act(() => renderer.unmount());

    expect(changes).toHaveLength(1);
    expect(exercises(apply(changes, base))?.[0]?.reps).toBe("6-8");
  });

  it("empty reps falls back to 8-10 and trims typed reps", () => {
    const base = settingsWith(plan([{ id: "bench", reps: "5x5" }, { id: "row", reps: "5x5" }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "   ");
    type(renderer, "row reps", "  10-12 ");
    act(() => drafts.flushAll());

    const result = exercises(apply(changes, base));

    expect(result?.[0]?.reps).toBe("8-10");
    expect(result?.[1]?.reps).toBe("10-12");
  });

  it("never saves an empty or unchanged plan name, and trims a new one", () => {
    const base = settingsWith(plan([]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "Plan name", "   ");
    act(() => drafts.flushAll());
    type(renderer, "Plan name", "Plan");
    act(() => drafts.flushAll());
    type(renderer, "Plan name", " Plan ");
    act(() => drafts.flushAll());

    expect(changes).toHaveLength(0);

    type(renderer, "Plan name", "  Upper/Lower ");
    act(() => drafts.flushAll());

    expect(changes).toHaveLength(1);
    expect(apply(changes, base).plans[0]?.name).toBe("Upper/Lower");
  });

  it("an emptied day name keeps the old name; a new one is trimmed", () => {
    const base = settingsWith(plan([]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "Day name", "   ");
    act(() => drafts.flushAll());

    expect(apply(changes, base).plans[0]?.days[0]?.name).toBe("Push");

    type(renderer, "Day name", " Pull ");
    act(() => drafts.flushAll());

    expect(apply(changes, base).plans[0]?.days[0]?.name).toBe("Pull");
  });

  it("does not write a removed row's reps draft into its neighbour", () => {
    const base = settingsWith(plan([{ id: "bench" }, { id: "row", reps: "12" }]));
    const { changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "1x1");

    // Bench is removed before the draft is committed; row slides to index 0.
    const removed = settingsWith(plan([{ id: "row", reps: "12" }]));

    act(() => renderer.unmount());

    expect(exercises(apply(changes, removed))).toEqual(exercises(removed));
  });

  it("does not write a reordered row's reps draft into the exercise now at that index", () => {
    const base = settingsWith(plan([{ id: "bench" }, { id: "row", reps: "12" }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "bench reps", "1x1");

    // Stored order changed under the open draft: row is now first.
    const reordered = settingsWith(plan([{ id: "row", reps: "12" }, { id: "bench" }]));

    act(() => drafts.flushAll());

    expect(exercises(apply(changes, reordered))).toEqual(exercises(reordered));
  });

  it("still lands on the right row when it is the same exercise at the same index", () => {
    const base = settingsWith(plan([{ id: "bench" }, { id: "row", reps: "12" }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "row reps", "15");
    act(() => drafts.flushAll());

    const result = exercises(apply(changes, base));

    expect(result?.[0]?.reps).toBe("8-10");
    expect(result?.[1]?.reps).toBe("15");
  });
});
