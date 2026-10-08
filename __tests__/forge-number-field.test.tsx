import { createElement } from "react";

import {
  createDraftRegistry,
  DraftScope,
  NumberField,
} from "@/components/workouts/forge-session";
import { PlanView } from "@/components/workouts/forge-plan";
import type { ForgeData } from "@/hooks/use-forge";
import type { ForgeSettings, Plan } from "@/types/forge";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// forge-session -> use-forge -> expo-router (untransformed ESM under this
// Jest setup). Same isolation the other Forge suites use (forge-prs-hook,
// forge-session-flush): stub expo-router and the toast, load use-forge as is.
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn() }));

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  DayMenuSheet: () => null,
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
  root: { findAll: (p: (n: { props: Record<string, unknown> }) => boolean) => { props: Props }[] };
  unmount: () => void;
};

const field = (renderer: Renderer, label: string): Props => {
  const found = renderer.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === "function",
  )[0];

  if (!found) throw new Error(`No field "${label}"`);

  return found.props;
};

const type = (renderer: Renderer, label: string, text: string) =>
  act(() => field(renderer, label).onChangeText?.(text));

function mountField(props: { decimal?: boolean; value?: number } = {}) {
  const registry = createDraftRegistry();
  const onCommit = jest.fn();
  let renderer!: Renderer;

  act(() => {
    renderer = TestRenderer.create(
      createElement(
        DraftScope,
        { value: registry },
        createElement(NumberField, {
          label: "f",
          placeholder: "p",
          onCommit,
          decimal: props.decimal,
          value: props.value,
        }),
      ),
    );
  });

  return { registry, onCommit, renderer };
}

describe("NumberField drafts", () => {
  it("commits a typed draft when explicitly flushed, before any unmount", () => {
    const { registry, onCommit, renderer } = mountField();

    type(renderer, "f", "100");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => registry.flushAll());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(100);

    act(() => renderer.unmount());
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not double-commit across blur, endEditing, flush and unmount", () => {
    const { registry, onCommit, renderer } = mountField();

    type(renderer, "f", "8");
    act(() => field(renderer, "f").onBlur?.());
    act(() => field(renderer, "f").onEndEditing?.());
    act(() => registry.flushAll());
    act(() => renderer.unmount());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(8);
  });

  it("still commits on blur and endEditing without a flush", () => {
    const { onCommit, renderer } = mountField();

    type(renderer, "f", "12");
    act(() => field(renderer, "f").onEndEditing?.());
    expect(onCommit).toHaveBeenCalledWith(12);
  });

  it("keeps rejecting invalid text", () => {
    const { registry, onCommit, renderer } = mountField({ decimal: true });

    for (const text of ["abc", "-", "1e999"]) {
      type(renderer, "f", text);
      act(() => registry.flushAll());
    }

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("allows a negative decimal weight (assisted work)", () => {
    const { registry, onCommit, renderer } = mountField({ decimal: true });

    type(renderer, "f", "-12,5");
    act(() => registry.flushAll());
    expect(onCommit).toHaveBeenCalledWith(-12.5);
  });

  it("clamps integer fields (reps) at 0 and rounds", () => {
    const { registry, onCommit, renderer } = mountField();

    type(renderer, "f", "-3");
    act(() => registry.flushAll());
    type(renderer, "f", "4.6");
    act(() => registry.flushAll());

    expect(onCommit.mock.calls).toEqual([[0], [5]]);
  });

  it("commits 0 for an emptied field", () => {
    const { registry, onCommit, renderer } = mountField({ value: 5 });

    type(renderer, "f", "");
    act(() => registry.flushAll());
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("commits a pending draft on unmount as a final safety net", () => {
    const { onCommit, renderer } = mountField();

    type(renderer, "f", "7");
    act(() => renderer.unmount());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(7);
  });
});

describe("Plan NumberFields", () => {
  const plan = (exercises: { id: string; sets: number; weight: number }[]): Plan => ({
    id: "p1",
    name: "Plan",
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: exercises.map((entry) => ({
          exerciseId: entry.id,
          name: entry.id,
          sets: entry.sets,
          reps: "8-10",
          weight: entry.weight,
        })),
      },
    ],
    schedule: {},
    rotate: false,
    deload: false,
    updatedAt: "2026-03-01T00:00:00.000Z",
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

  it("persists a typed value when the tab is left (explicit flush)", () => {
    const base = settingsWith(plan([{ id: "bench", sets: 3, weight: 0 }]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "bench sets", "5");
    type(renderer, "bench weight", "60");
    act(() => drafts.flushAll());
    act(() => renderer.unmount());

    const saved = apply(changes, base).plans[0]?.days[0]?.exercises[0];

    expect(saved?.sets).toBe(5);
    expect(saved?.weight).toBe(60);
    expect(changes).toHaveLength(2);
  });

  it("persists a typed barbell weight when the tab is left", () => {
    const base = settingsWith(plan([]));
    const { drafts, changes, renderer } = mountPlan(base);

    type(renderer, "Barbell weight", "15");
    act(() => drafts.flushAll());
    expect(apply(changes, base).barKg).toBe(15);
  });

  it("does not write a removed row's draft into its neighbour", () => {
    const base = settingsWith(
      plan([
        { id: "bench", sets: 3, weight: 0 },
        { id: "row", sets: 4, weight: 40 },
      ]),
    );
    const { changes, renderer } = mountPlan(base);

    type(renderer, "bench sets", "9");

    // Bench is removed before the draft is committed; row slides to index 0.
    const removed = settingsWith(plan([{ id: "row", sets: 4, weight: 40 }]));

    act(() => renderer.unmount());

    const result = apply(changes, removed).plans[0]?.days[0]?.exercises;

    expect(result).toEqual(removed.plans[0]?.days[0]?.exercises);
  });
});
