import { createElement } from "react";
import { ToastHost } from "@/components/ui/toast-host";
import { clearToast, showToast } from "@/utils/toast";
import { ManualSheet } from "@/components/nutrition/log-sheets";
import { ChangeLogSheet } from "@/components/nutrition/more-sheets";
import { N } from "@/constants/nourish-theme";
import { Bar } from "@/components/ds/bar";

jest.mock("@/global.css", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
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
    )[0];
    if (found?.props?.onPress) {
      TestRenderer.act(() => {
        found.props.onPress();
      });
    }
  };

  return {
    getTexts,
    press,
    renderer: activeRenderer,
  };
}

describe("Part 13 — Nourish Polish", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
  });

  afterEach(() => {
    if (activeRenderer) {
      TestRenderer.act(() => {
        activeRenderer.unmount();
      });
      activeRenderer = null;
    }
    clearToast();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("ToastHost Polish", () => {
    it("renders floating card toast with ok and bad tokens and 4s duration", () => {
      const { getTexts, renderer } = render(createElement(ToastHost));

      TestRenderer.act(() => {
        showToast("Targets updated", "success");
      });

      expect(getTexts()).toContain("Targets updated");

      // Verify success dot token
      const tree = renderer.toJSON();
      const dot = tree?.children?.[0]?.children?.[0];
      const dotStyle = Array.isArray(dot?.props?.style)
        ? Object.assign({}, ...dot.props.style)
        : dot?.props?.style;
      expect(dotStyle?.backgroundColor).toBe(N.ok);

      // Verify card styling (floating card with borderRadius 14)
      const cardStyle = Array.isArray(tree?.props?.style)
        ? Object.assign({}, ...tree.props.style)
        : tree?.props?.style;
      expect(cardStyle?.borderRadius).toBe(14);
      expect(cardStyle?.backgroundColor).toBe(N.card);

      // Verify 4-second default duration: still visible after 3s, dismissed after 4.3s
      TestRenderer.act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(getTexts()).toContain("Targets updated");

      TestRenderer.act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(getTexts()).not.toContain("Targets updated");
    });

    it("renders error toast with bad token and optional action button", () => {
      const onRetry = jest.fn();
      const { getTexts, press, renderer } = render(createElement(ToastHost));

      TestRenderer.act(() => {
        showToast("Connection failed", "error", {
          action: { label: "Retry", onPress: onRetry },
        });
      });

      expect(getTexts()).toContain("Connection failed");
      expect(getTexts()).toContain("Retry");

      const tree = renderer.toJSON();
      const dot = tree?.children?.[0]?.children?.[0];
      const dotStyle = Array.isArray(dot?.props?.style)
        ? Object.assign({}, ...dot.props.style)
        : dot?.props?.style;
      expect(dotStyle?.backgroundColor).toBe(N.bad);

      press("Retry");
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("ManualSheet ('Add food')", () => {
    it("renders with 'Add food' title, field labels, 2x2 48dp grid, helper text, and validation on blur/save", () => {
      const mockLogger = {
        manual: { name: "", dayKey: "2026-10-09", at: "12:30" },
        setManual: jest.fn(),
        busy: false,
        saveManual: jest.fn(),
      } as any;

      const { getTexts, press, renderer } = render(
        createElement(ManualSheet, { logger: mockLogger }),
      );

      const texts = getTexts();
      expect(texts).toContain("Add food");
      expect(texts).toContain("Food name");
      expect(texts).toContain("Amount (optional)");
      expect(texts).toContain("Calories");
      expect(texts).toContain("Protein (g)");
      expect(texts).toContain("Carbs (g)");
      expect(texts).toContain("Fat (g)");
      expect(texts).toContain("Calories are filled in from macros if you leave them blank");

      // Validation should NOT be visible on initial open
      expect(texts).not.toContain("Add a food name.");
      expect(texts).not.toContain("Add at least one number.");

      // Check 48dp height on macro input fields
      const inputs = renderer.root.findAll((n: any) => n.type === "TextInput");
      const macroInputs = inputs.filter((input: any) => {
        const style = Array.isArray(input.props?.style)
          ? Object.assign({}, ...input.props.style)
          : input.props?.style;
        return style?.height === 48;
      });
      expect(macroInputs.length).toBe(4);

      // Trigger Save attempt with empty inputs -> validation error appears
      press("Save");
      const errorTexts = getTexts();
      expect(errorTexts).toContain("Add a food name.");
    });
  });

  describe("Bar Component 20% Track", () => {
    it("renders colored bar on 20% opacity track", () => {
      const { renderer } = render(
        createElement(Bar, { value: 50, max: 100, color: N.protein, height: 6 }),
      );

      const tree = renderer.toJSON();
      const trackStyle = Array.isArray(tree?.props?.style)
        ? Object.assign({}, ...tree.props.style)
        : tree?.props?.style;
      // N.protein is #c8735a, so 20% track is #c8735a33
      expect(trackStyle?.backgroundColor).toBe(`${N.protein}33`);
    });
  });

  describe("ChangeLogSheet ('Why did my targets change?')", () => {
    it("renders 14-day change-guard explanation and change log history", () => {
      const changeLog = [
        { date: "2026-10-01T10:00:00Z", change: "Calories 2,200 → 2,400" },
        { date: "2026-10-08T12:00:00Z", change: "Protein 160g → 175g" },
      ];

      const { getTexts } = render(
        createElement(ChangeLogSheet, {
          visible: true,
          onClose: jest.fn(),
          changeLog,
        }),
      );

      const texts = getTexts();
      expect(texts).toContain("Why did my targets change?");
      expect(texts).toContain("14-day change guard");
      expect(texts.some((t) => t.includes("Target changes are guarded"))).toBe(true);
      expect(texts).toContain("Calories 2,200 → 2,400");
      expect(texts).toContain("Protein 160g → 175g");
    });
  });
});
