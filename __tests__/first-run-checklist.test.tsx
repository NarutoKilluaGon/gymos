import React from "react";
import { FirstRunChecklistCard } from "@/components/dashboard/first-run-checklist";

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");

type Node = {
  type?: string;
  props?: Record<string, unknown>;
  children?: (Node | string)[] | null;
};

function renderCard(element: React.ReactElement) {
  let renderer: {
    toJSON: () => Node | Node[] | null;
    root: {
      findAll: (
        p: (n: { props: Record<string, unknown> }) => boolean
      ) => { props: Record<string, unknown> }[];
    };
  };

  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });

  const texts: string[] = [];
  const walk = (node: Node | string | null | (Node | string)[]) => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else (node.children ?? []).forEach(walk);
  };

  walk(renderer!.toJSON());

  return {
    toJSON: () => renderer.toJSON(),
    texts,
    press: (label: string) =>
      renderer!.root
        .findAll(
          (n) =>
            n.props.accessibilityLabel === label &&
            typeof n.props.onPress === "function"
        )[0]
        ?.props.onPress as (() => void) | undefined,
  };
}

describe("FirstRunChecklistCard", () => {
  it("renders when items are incomplete", () => {
    const { texts, toJSON } = renderCard(
      <FirstRunChecklistCard
        mealsCount={0}
        hasWorkout={false}
        waterMl={0}
        onLogMeal={jest.fn()}
        onStartWorkout={jest.fn()}
        onAddWater={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(toJSON()).not.toBeNull();
    expect(texts).toContain("0/3 completed");
    expect(texts).toContain("Log your first meal");
    expect(texts).toContain("Start your first workout");
    expect(texts).toContain("Add water");
  });

  it("updates completed counter as actions are taken", () => {
    const { texts } = renderCard(
      <FirstRunChecklistCard
        mealsCount={1}
        hasWorkout={true}
        waterMl={0}
        onLogMeal={jest.fn()}
        onStartWorkout={jest.fn()}
        onAddWater={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(texts).toContain("2/3 completed");
  });

  it("auto-hides when all 3 items are completed", () => {
    const { toJSON } = renderCard(
      <FirstRunChecklistCard
        mealsCount={1}
        hasWorkout={true}
        waterMl={500}
        onLogMeal={jest.fn()}
        onStartWorkout={jest.fn()}
        onAddWater={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(toJSON()).toBeNull();
  });

  it("fires callbacks when pressed", () => {
    const onLogMeal = jest.fn();
    const onDismiss = jest.fn();

    const { press } = renderCard(
      <FirstRunChecklistCard
        mealsCount={0}
        hasWorkout={false}
        waterMl={0}
        onLogMeal={onLogMeal}
        onStartWorkout={jest.fn()}
        onAddWater={jest.fn()}
        onDismiss={onDismiss}
      />
    );

    press("Log your first meal")?.();
    expect(onLogMeal).toHaveBeenCalledTimes(1);

    press("Dismiss checklist")?.();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
