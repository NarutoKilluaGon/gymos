import { createElement } from "react";

import { PlanView } from "@/components/workouts/forge-plan";
import type { ForgeData } from "@/hooks/use-forge";
import type { ForgeSettings, Plan } from "@/types/forge";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// The sheets are captured so a test can drive their callbacks directly.
const mockSheets: {
  newPlan?: { onCreate: (template: string | null, name: string) => void };
} = {};

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  DayMenuSheet: () => null,
  ExercisePickerSheet: () => null,
  NewPlanSheet: (props: {
    onCreate: (template: string | null, name: string) => void;
  }) => {
    mockSheets.newPlan = props;

    return null;
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => unknown = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = {
  props: Record<string, unknown>;
  parent: Node | null;
  children: unknown[];
};
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  unmount: () => void;
};
type Change = (current: ForgeSettings) => ForgeSettings;

const row = (id: string, extra: Partial<Plan["days"][number]["exercises"][number]> = {}) => ({
  exerciseId: id,
  name: id,
  sets: 3,
  reps: "8-10",
  weight: 0,
  ...extra,
});

const settingsOf = (ids: string[]): ForgeSettings => ({
  plans: [
    {
      id: "p1",
      name: "Plan",
      days: [{ id: "d1", name: "Push", exercises: ids.map((id) => row(id)) }],
      schedule: {},
      rotate: false,
      deload: false,
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
  activePlanId: "p1",
  restSeconds: 90,
  barKg: 20,
  routinesImported: true,
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * Mounts PlanView against a fake store. `data` is fixed at mount, so the
 * rendered buttons stay as they were: exactly what a second tap lands on
 * before the first save has re-rendered the screen.
 */
function mount(initial: ForgeSettings, gate?: () => Promise<void>) {
  const store = { settings: initial };
  const saves = jest.fn();
  const data: ForgeData = {
    sessions: [],
    settings: initial,
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
        onSave: async (change: Change) => {
          saves();

          if (gate) await gate();

          store.settings = change(store.settings);

          return true;
        },
        onCreateExercise: async () => null,
      }),
    );
  });

  const press = (label: string, nth = 0) => {
    const hits = renderer.root.findAll(
      (n) => n.children?.length === 1 && n.children[0] === label,
    );
    let node: Node | null = hits[nth] ?? null;

    while (node && typeof node.props.onPress !== "function") node = node.parent;

    if (!node) throw new Error(`No pressable for "${label}" #${nth}`);

    act(() => (node!.props.onPress as () => void)());
  };

  const ids = () =>
    store.settings.plans[0]?.days[0]?.exercises.map((entry) => entry.exerciseId);

  return { store, saves, renderer, press, ids };
}

describe("Plan row actions use the rows that were shown", () => {
  it("tapping Remove twice on the same row removes one exercise, not its neighbour", async () => {
    const { press, ids } = mount(settingsOf(["a", "b", "c"]));

    // Second row's Remove (index 1), tapped twice before the screen updates.
    press("Remove", 1);
    press("Remove", 1);
    await flush();

    expect(ids()).toEqual(["a", "c"]);
  });

  it("tapping Remove on the last row twice does not remove the one before it", async () => {
    const { press, ids } = mount(settingsOf(["a", "b"]));

    press("Remove", 1);
    press("Remove", 1);
    await flush();

    expect(ids()).toEqual(["a"]);
  });

  it("tapping ↑ twice moves the row up once instead of moving it back", async () => {
    const { press, ids } = mount(settingsOf(["a", "b", "c"]));

    press("↑", 0); // first ↑ belongs to index 1 ("b")
    press("↑", 0);
    await flush();

    expect(ids()).toEqual(["b", "a", "c"]);
  });

  it("tapping Superset twice links once instead of toggling it back", async () => {
    const { press, store } = mount(settingsOf(["a", "b"]));

    press("Superset", 0);
    press("Superset", 0);
    await flush();

    expect(store.settings.plans[0]?.days[0]?.exercises[0]?.superset).toBe(true);
  });

  it("a stale second Remove cannot delete the adjacent copy of a duplicate exercise", async () => {
    const { press, ids } = mount(settingsOf(["a", "a", "c"]));

    press("Remove", 0);
    press("Remove", 0);
    await flush();

    expect(ids()).toEqual(["a", "c"]);
  });

  it("a stale second Remove on the last of two duplicates removes only one", async () => {
    const { press, ids } = mount(settingsOf(["a", "a"]));

    press("Remove", 1);
    press("Remove", 1);
    await flush();

    expect(ids()).toEqual(["a"]);
  });

  it("a stale second ↑ cannot swap the wrong duplicate row", async () => {
    const { press, ids } = mount(settingsOf(["a", "b", "a"]));

    press("↑", 1); // the last "a" moves above "b"
    press("↑", 1);
    await flush();

    expect(ids()).toEqual(["a", "a", "b"]);
  });

  describe("a committed sets/reps/weight edit does not block a valid row action", () => {
    // The render is stale (as just after a draft commit, before the reload),
    // while storage already holds new targets for "b".
    const edited = () => {
      const settings = settingsOf(["a", "b", "c"]);
      const day = settings.plans[0]!.days[0]!;

      day.exercises[1] = { ...day.exercises[1]!, sets: 5, reps: "5x5", weight: 100 };

      return settings;
    };

    it("Remove", async () => {
      const { press, store, ids } = mount(settingsOf(["a", "b", "c"]));

      store.settings = edited();
      press("Remove", 1);
      await flush();

      expect(ids()).toEqual(["a", "c"]);
    });

    it("↑", async () => {
      const { press, store, ids } = mount(settingsOf(["a", "b", "c"]));

      store.settings = edited();
      press("↑", 0); // "b"
      await flush();

      expect(ids()).toEqual(["b", "a", "c"]);
      expect(store.settings.plans[0]?.days[0]?.exercises[0]).toMatchObject({
        sets: 5,
        reps: "5x5",
        weight: 100,
      });
    });

    it("Superset", async () => {
      const { press, store } = mount(settingsOf(["a", "b", "c"]));

      store.settings = edited();
      press("Superset", 1); // "b"
      await flush();

      expect(store.settings.plans[0]?.days[0]?.exercises[1]).toMatchObject({
        superset: true,
        sets: 5,
        reps: "5x5",
        weight: 100,
      });
    });
  });

  it("does nothing if the stored day changed since the button was drawn", async () => {
    const { press, store, ids, saves } = mount(settingsOf(["a", "b", "c"]));

    // Another write reordered the stored day under the stale screen.
    store.settings = settingsOf(["c", "a", "b"]);

    press("Remove", 0); // the screen still shows "a" first
    await flush();

    expect(saves).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(["c", "a", "b"]);
  });

  it("still removes, moves and links the right row on a single tap", async () => {
    const removed = mount(settingsOf(["a", "b", "c"]));

    removed.press("Remove", 1);
    await flush();
    expect(removed.ids()).toEqual(["a", "c"]);

    const moved = mount(settingsOf(["a", "b", "c"]));

    moved.press("↑", 1); // second ↑ belongs to index 2 ("c")
    await flush();
    expect(moved.ids()).toEqual(["a", "c", "b"]);

    const linked = mount(settingsOf(["a", "b", "c"]));

    linked.press("Superset", 1);
    await flush();
    expect(
      linked.store.settings.plans[0]?.days[0]?.exercises.map((entry) => entry.superset ?? false),
    ).toEqual([false, true, false]);
  });
});

describe("Plan view duplicate taps", () => {
  it("creates one plan when New plan fires twice before the save finishes", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { store, saves } = mount(settingsOf(["a"]), () => held);

    act(() => mockSheets.newPlan?.onCreate(null, "Upper"));
    act(() => mockSheets.newPlan?.onCreate("Push Pull Legs", "Upper"));

    expect(saves).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await held;
    });

    expect(store.settings.plans).toHaveLength(2);
  });

  it("allows another plan once the first save has finished", async () => {
    const { store, saves } = mount(settingsOf(["a"]));

    act(() => mockSheets.newPlan?.onCreate(null, "One"));
    await flush();
    await flush();
    act(() => mockSheets.newPlan?.onCreate(null, "Two"));
    await flush();

    expect(saves).toHaveBeenCalledTimes(2);
    expect(store.settings.plans.map((plan) => plan.name)).toEqual(["Plan", "One", "Two"]);
  });

  const typeDay = (renderer: Renderer, text: string) => {
    const input = renderer.root.findAll(
      (n) => n.props.placeholder === "Push, Legs, Day A…" && typeof n.props.onChangeText === "function",
    )[0];

    act(() => (input!.props.onChangeText as (t: string) => void)(text));
  };

  const dayInput = (renderer: Renderer) =>
    renderer.root.findAll(
      (n) => n.props.placeholder === "Push, Legs, Day A…" && typeof n.props.onChangeText === "function",
    )[0]!.props.value;

  it("Add day keeps the typed name until the day is saved, and adds one day on a double tap", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { store, saves, renderer, press } = mount(settingsOf(["a"]), () => held);

    typeDay(renderer, "Legs");
    press("Add day");
    press("Add day");

    expect(saves).toHaveBeenCalledTimes(1);
    expect(dayInput(renderer)).toBe("Legs");

    await act(async () => {
      release();
      await held;
    });
    await flush();

    expect(store.settings.plans[0]?.days.map((day) => day.name)).toEqual(["Push", "Legs"]);
    expect(dayInput(renderer)).toBe("");
  });

  it("Add day keeps the name when the save fails so it can be retried", async () => {
    const data: ForgeData = {
      sessions: [],
      settings: settingsOf(["a"]),
      custom: [],
      catalog: [],
      cardio: {},
      bodyweightKg: undefined,
    };
    const onSave = jest.fn(async () => false);
    let renderer!: Renderer;

    act(() => {
      renderer = TestRenderer.create(
        createElement(PlanView, {
          data,
          unit: "kg",
          onSave,
          onCreateExercise: async () => null,
        }),
      );
    });

    typeDay(renderer, "Legs");

    const button = renderer.root.findAll(
      (n) => n.children?.length === 1 && n.children[0] === "Add day",
    )[0]!;
    let node: Node | null = button;

    while (node && typeof node.props.onPress !== "function") node = node.parent;

    act(() => (node!.props.onPress as () => void)());
    await flush();
    await flush();

    expect(dayInput(renderer)).toBe("Legs");

    act(() => (node!.props.onPress as () => void)());
    await flush();

    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
