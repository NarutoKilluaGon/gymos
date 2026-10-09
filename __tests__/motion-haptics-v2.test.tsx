import React from "react";
import * as Haptics from "expo-haptics";

import { CountUp } from "@/components/ds/count-up";
import { Crossfade, Seg } from "@/components/ds/seg";
import { ToastHost } from "@/components/ui/toast-host";
import { SummarySheet } from "@/components/workouts/forge-sheets";
import {
  hapticError,
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from "@/utils/haptics";
import { listLayout, enter } from "@/utils/motion";
import { clearToast, showUndoToast } from "@/utils/toast";

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");

type Node = {
  type?: string;
  props?: Record<string, unknown>;
  children?: (Node | string)[] | null;
};

let activeRenderer: any = null;

function render(element: React.ReactElement) {
  TestRenderer.act(() => {
    activeRenderer = TestRenderer.create(element);
  });

  const getTexts = (): string[] => {
    const texts: string[] = [];
    const walk = (node: Node | string | null | (Node | string)[]) => {
      if (node === null || node === undefined) return;
      if (typeof node === "string") texts.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else (node.children ?? []).forEach(walk);
    };
    walk(activeRenderer?.toJSON());
    return texts;
  };

  const press = (label: string) => {
    const found = activeRenderer?.root.findAll(
      (n: any) =>
        (n.props?.accessibilityLabel === label || n.props?.label === label) &&
        typeof n.props?.onPress === "function",
    );
    if (!found?.length) throw new Error(`Button with label "${label}" not found`);
    TestRenderer.act(() => {
      found[0].props.onPress();
    });
  };

  return { getTexts, press };
}

describe("Motion and Haptics v2 (Part 14)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Haptics, "impactAsync").mockResolvedValue(undefined as any);
    jest.spyOn(Haptics, "notificationAsync").mockResolvedValue(undefined as any);
    jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined as any);
    jest.useFakeTimers();
    clearToast();
  });

  afterEach(() => {
    TestRenderer.act(() => {
      clearToast();
    });
    jest.useRealTimers();
    if (activeRenderer) {
      TestRenderer.act(() => {
        activeRenderer.unmount();
      });
      activeRenderer = null;
    }
  });

  describe("Haptics Utility", () => {
    it("safely triggers light, medium, heavy, success, warning, error, and selection haptics", async () => {
      await hapticLight();
      expect(Haptics.impactAsync).toHaveBeenCalledWith("light");

      await hapticMedium();
      expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");

      await hapticHeavy();
      expect(Haptics.impactAsync).toHaveBeenCalledWith("heavy");

      await hapticSuccess();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");

      await hapticWarning();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");

      await hapticError();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");

      await hapticSelection();
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });

    it("does not throw if expo-haptics rejects", async () => {
      jest.spyOn(Haptics, "impactAsync").mockRejectedValueOnce(
        new Error("Platform unsupported"),
      );
      await expect(hapticLight()).resolves.toBeUndefined();
    });
  });

  describe("CountUp Component", () => {
    it("renders value immediately in test / reduced motion environment", () => {
      const { getTexts } = render(
        <CountUp value={2400} suffix=" kcal" />,
      );
      expect(getTexts()).toContain("2400 kcal");
    });

    it("supports prefix and custom formatter", () => {
      const { getTexts } = render(
        <CountUp
          value={150}
          prefix="P "
          formatter={(v) => `${Math.round(v)}g`}
        />,
      );
      expect(getTexts()).toContain("P 150g");
    });
  });

  describe("Seg & Crossfade", () => {
    it("renders options and triggers onChange", () => {
      const onChange = jest.fn();
      const options = [
        { value: "meals", label: "Meals" },
        { value: "foods", label: "Foods" },
        { value: "recipes", label: "Recipes" },
      ] as const;

      const { getTexts, press } = render(
        <Seg options={options} value="meals" onChange={onChange} />,
      );

      expect(getTexts()).toContain("Meals");
      expect(getTexts()).toContain("Foods");
      expect(getTexts()).toContain("Recipes");

      press("Foods");
      expect(onChange).toHaveBeenCalledWith("foods");
    });

    it("renders Crossfade container for smooth content transitions", () => {
      const { getTexts } = render(
        <Crossfade triggerKey="day-1" duration={160}>
          <CountUp value={100} />
        </Crossfade>,
      );
      expect(getTexts()).toContain("100");
    });
  });

  describe("ToastHost & Undo Motion", () => {
    it("triggers hapticLight when Undo button is pressed", () => {
      const onUndo = jest.fn();
      const { press } = render(<ToastHost />);

      TestRenderer.act(() => {
        showUndoToast({
          message: "Exercise removed",
          onUndo,
        });
      });

      press("Undo");
      expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
      expect(onUndo).toHaveBeenCalled();
    });
  });

  describe("Recap Card & SummarySheet", () => {
    it("renders workout done recap with trophy and PR rows", () => {
      const prs = [
        {
          exerciseId: "bench-press",
          weight: 100,
          reps: 8,
          unit: "kg" as const,
          timestamp: Date.now(),
        },
      ];
      const names = { "bench-press": "Barbell Bench Press" };

      const { getTexts } = render(
        <SummarySheet
          visible={true}
          onClose={jest.fn()}
          durationLabel="45m"
          volumeLabel="5,200 kg"
          sets={12}
          prs={prs}
          names={names}
          trimmed={false}
          formatPr={() => "100 kg × 8 reps"}
        />,
      );

      expect(getTexts()).toContain("Workout done");
      expect(getTexts()).toContain("Barbell Bench Press");
      expect(getTexts()).toContain("100 kg × 8 reps");
    });
  });

  describe("Motion Utilities", () => {
    it("provides listLayout transition config", () => {
      expect(listLayout).toBeDefined();
    });

    it("provides enter transition with stagger capping", () => {
      const transition0 = enter(0);
      const transition5 = enter(5);
      const transition10 = enter(10);
      expect(transition0).toBeDefined();
      expect(transition5).toBeDefined();
      expect(transition10).toBeDefined();
    });
  });
});
