import { createElement } from "react";
import { AppState } from "react-native";

import { ForgeApp } from "@/components/workouts/forge-app";
import { useForge } from "@/hooks/use-forge";
import type { WorkoutSession } from "@/types/gymos";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));
jest.mock("@/hooks/use-forge", () => ({ useForge: jest.fn() }));

jest.mock("@/components/workouts/forge-sheets", () => ({
  ConfirmSheet: () => null,
  ExercisePickerSheet: () => null,
  FinishSheet: () => null,
  NewPlanSheet: () => null,
  NoteSheet: () => null,
  PlatesSheet: () => null,
  SummarySheet: () => null,
}));

// What the stubbed screens expose to the test.
const mockScreens: {
  today?: { onOpen: (session: unknown) => void };
  planCommit: jest.Mock;
  sessionFlush: jest.Mock;
} = {
  planCommit: jest.fn(),
  sessionFlush: jest.fn(),
};

jest.mock("@/components/workouts/forge-today", () => ({
  TodayView: (props: { onOpen: (session: unknown) => void }) => {
    mockScreens.today = props;

    return null;
  },
}));
jest.mock("@/components/workouts/forge-history", () => ({
  HistoryView: () => null,
}));
// Stand-in for the Plan tab: one registered draft, like a field with typed text.
jest.mock("@/components/workouts/forge-plan", () => {
  const { useEffect } = require("react");

  return {
    PlanView: (props: { drafts?: { register: (commit: () => void) => () => void } }) => {
      useEffect(
        () => props.drafts?.register(() => mockScreens.planCommit()),
        [props.drafts],
      );

      return null;
    },
  };
});
// Real draft registry; the session screen is replaced by one that publishes
// its flush the way the real one does.
jest.mock("@/components/workouts/forge-session", () => {
  const actual = jest.requireActual("@/components/workouts/forge-session");

  return {
    ...actual,
    ForgeSession: (props: {
      flushRef: { current: (() => Promise<void>) | null };
    }) => {
      props.flushRef.current = () => mockScreens.sessionFlush();

      return null;
    },
  };
});

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = { props: Record<string, unknown>; parent: Node | null; children: unknown[] };
type Renderer = {
  root: { findAll: (p: (n: Node) => boolean) => Node[] };
  unmount: () => void;
};

const mockUseForge = useForge as jest.MockedFunction<typeof useForge>;

const open: WorkoutSession = {
  id: "s1",
  name: "Push",
  startedAt: "2026-03-01T10:00:00.000Z",
  date: "2026-03-01",
  exercises: [],
};

let handler: ((state: string) => void) | undefined;
let removeListener: jest.Mock;
let addListener: jest.SpyInstance;
let mounted: Renderer | undefined;

function mount() {
  act(() => {
    mounted = TestRenderer.create(createElement(ForgeApp));
  });

  return mounted as Renderer;
}

/** Press whatever owns the Text with this content (e.g. a Seg option). */
const pressText = (renderer: Renderer, text: string) => {
  const node = renderer.root.findAll((n) => n.children?.length === 1 && n.children[0] === text)[0];
  let owner: Node | null = node ?? null;

  while (owner && typeof owner.props.onPress !== "function") owner = owner.parent;

  if (!owner) throw new Error(`No pressable for "${text}"`);

  return act(() => (owner!.props.onPress as () => void)());
};

const background = (state: string) =>
  act(async () => {
    handler?.(state);
  });

beforeEach(() => {
  mockScreens.planCommit = jest.fn();
  mockScreens.sessionFlush = jest.fn(async () => undefined);
  mockScreens.today = undefined;
  handler = undefined;
  removeListener = jest.fn();
  addListener = jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _type: string,
    listener: (state: string) => void,
  ) => {
    handler = listener;

    return { remove: removeListener };
  }) as never);

  mockUseForge.mockReturnValue({
    data: {
      sessions: [],
      settings: { plans: [], activePlanId: "", restSeconds: 0, barKg: 20, routinesImported: true },
      custom: [],
      catalog: [],
      cardio: {},
      bodyweightKg: undefined,
    },
    unit: "kg",
    reload: jest.fn(async () => undefined),
    actions: { resume: jest.fn(async () => open) },
    weightKg: 65,
    toKgInUnit: (value: number) => value,
  } as unknown as ReturnType<typeof useForge>);
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
  addListener.mockRestore();
});

describe("ForgeApp leaving the foreground", () => {
  it.each(["background", "inactive"])(
    "flushes the Plan tab's pending drafts when the app goes %s",
    async (state) => {
      const renderer = mount();

      await pressText(renderer, "Plan");
      await background(state);

      expect(mockScreens.planCommit).toHaveBeenCalledTimes(1);
      expect(mockScreens.sessionFlush).not.toHaveBeenCalled();
    },
  );

  it.each(["background", "inactive"])(
    "flushes the open session's drafts and save queue when the app goes %s",
    async (state) => {
      mount();

      await act(async () => {
        mockScreens.today?.onOpen(open);
      });
      await background(state);

      expect(mockScreens.sessionFlush).toHaveBeenCalledTimes(1);
      expect(mockScreens.planCommit).not.toHaveBeenCalled();
    },
  );

  it("does nothing when the app becomes active", async () => {
    const renderer = mount();

    await pressText(renderer, "Plan");
    await background("active");

    expect(mockScreens.planCommit).not.toHaveBeenCalled();
    expect(mockScreens.sessionFlush).not.toHaveBeenCalled();
  });

  it("does not fail when there is nothing open to flush", async () => {
    mount();

    await expect(background("background")).resolves.toBeUndefined();
    expect(mockScreens.planCommit).not.toHaveBeenCalled();
    expect(mockScreens.sessionFlush).not.toHaveBeenCalled();
  });

  it("swallows a failing session flush instead of raising an unhandled rejection", async () => {
    mockScreens.sessionFlush = jest.fn(async () => {
      throw new Error("disk full");
    });

    mount();

    await act(async () => {
      mockScreens.today?.onOpen(open);
    });

    await expect(background("background")).resolves.toBeUndefined();
    expect(mockScreens.sessionFlush).toHaveBeenCalledTimes(1);
  });
});

describe("ForgeApp AppState listener", () => {
  it("subscribes once and keeps the same subscription across tab changes", async () => {
    const renderer = mount();

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(addListener.mock.calls[0]?.[0]).toBe("change");

    await pressText(renderer, "Plan");
    await pressText(renderer, "History");

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    mount();
    expect(removeListener).not.toHaveBeenCalled();

    act(() => mounted?.unmount());
    mounted = undefined;

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
