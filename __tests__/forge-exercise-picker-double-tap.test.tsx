import { createElement, type ReactNode } from "react";

import { ExercisePickerSheet } from "@/components/workouts/forge-sheets";
import type { CatalogExercise } from "@/types/forge";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// The real Modal is irrelevant here; render the sheet body whenever visible so
// the test can tap rows the way a second tap lands during the slide-out.
jest.mock("@/components/workouts/forge-ui", () => ({
  ...jest.requireActual("@/components/workouts/forge-ui"),
  Sheet: ({ children }: { children: ReactNode }) => children,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => unknown = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  update: (element: unknown) => void;
  unmount: () => void;
};

const BENCH = { id: "bench", name: "Bench Press", muscleGroup: "Chest", bodyweight: false } as CatalogExercise;
const MADE = { id: "mine", name: "Zercher", muscleGroup: "Chest", bodyweight: false } as CatalogExercise;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

function setup(onCreate: jest.Mock = jest.fn()) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  let renderer!: Renderer;
  const element = (visible: boolean) =>
    createElement(ExercisePickerSheet, {
      visible,
      onClose,
      catalog: [BENCH],
      onPick,
      onCreate,
    });

  act(() => {
    renderer = TestRenderer.create(element(true));
  });

  const press = (label: string) => {
    const hit = renderer.root.findAll(
      (n) => n.children?.length === 1 && n.children[0] === label,
    )[0];
    let node: Node | null = hit ?? null;

    while (node && typeof node.props.onPress !== "function") node = node.parent;

    if (!node) throw new Error(`No pressable for "${label}"`);

    act(() => (node!.props.onPress as () => void)());
  };

  const type = (text: string) => {
    const input = renderer.root.findAll(
      (n) => n.props.placeholder === "Search exercises" && typeof n.props.onChangeText === "function",
    )[0]!;

    act(() => (input.props.onChangeText as (t: string) => void)(text));
  };

  return { renderer, element, onPick, onClose, onCreate, press, type };
}

describe("ExercisePickerSheet duplicate taps", () => {
  it("picks an existing exercise once when its row is tapped twice", () => {
    const { onPick, press } = setup();

    press("Bench Press");
    press("Bench Press");

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(BENCH);
  });

  it("picks again after the sheet is closed and reopened", () => {
    const { renderer, element, onPick, press } = setup();

    press("Bench Press");
    act(() => renderer.update(element(false)));
    act(() => renderer.update(element(true)));
    press("Bench Press");

    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it("creates and picks a new exercise once when Add exercise is tapped twice", async () => {
    const pending = deferred<CatalogExercise | null>();
    const { onCreate, onPick, press, type } = setup(jest.fn(() => pending.promise));

    type("Zercher");
    press("Add exercise");
    press("Add exercise");

    expect(onCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(MADE);
      await pending.promise;
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(MADE);
  });

  it("lets the person retry Add exercise when creating failed", async () => {
    const onCreate = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(MADE);
    const { onPick, press, type } = setup(onCreate);

    type("Zercher");
    press("Add exercise");
    await act(async () => {
      await Promise.resolve();
    });

    expect(onPick).not.toHaveBeenCalled();

    press("Add exercise");
    await act(async () => {
      await Promise.resolve();
    });

    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
