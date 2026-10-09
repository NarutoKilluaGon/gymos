import { createElement } from "react";

import { ToastHost } from "@/components/ui/toast-host";
import { clearToast, showUndoToast } from "@/utils/toast";

jest.mock("@/global.css", () => ({}));

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
        n.props?.accessibilityLabel === label &&
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

describe("Undo Toast System", () => {
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

  it("renders an undo toast with message and Undo button", () => {
    const onUndo = jest.fn();
    const { getTexts } = render(createElement(ToastHost));

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Lat Pulldown", onUndo });
    });

    const texts = getTexts();
    expect(texts).toContain("Removed Lat Pulldown");
    expect(texts).toContain("Undo");
  });

  it("calls onUndo and dismisses when Undo button is pressed", () => {
    const onUndo = jest.fn();
    const { getTexts, press } = render(createElement(ToastHost));

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Back Squat", onUndo });
    });

    press("Undo");
    expect(onUndo).toHaveBeenCalledTimes(1);

    // Fast-forward animation
    TestRenderer.act(() => {
      jest.advanceTimersByTime(300);
    });

    const texts = getTexts();
    expect(texts).not.toContain("Removed Back Squat");
  });

  it("double-tapping Undo invokes onUndo only once", () => {
    const onUndo = jest.fn();
    const { press } = render(createElement(ToastHost));

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Set 3", onUndo });
    });

    press("Undo");
    press("Undo");

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("automatically dismisses after duration expires", () => {
    const onUndo = jest.fn();
    const { getTexts } = render(createElement(ToastHost));

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Cardio", onUndo, duration: 5000 });
    });

    expect(getTexts()).toContain("Removed Cardio");

    TestRenderer.act(() => {
      jest.advanceTimersByTime(5300);
    });

    expect(getTexts()).not.toContain("Removed Cardio");
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("a new toast replaces the previous one immediately", () => {
    const onUndo1 = jest.fn();
    const onUndo2 = jest.fn();
    const { getTexts, press } = render(createElement(ToastHost));

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Item 1", onUndo: onUndo1 });
    });
    expect(getTexts()).toContain("Removed Item 1");

    TestRenderer.act(() => {
      showUndoToast({ message: "Removed Item 2", onUndo: onUndo2 });
    });
    expect(getTexts()).not.toContain("Removed Item 1");
    expect(getTexts()).toContain("Removed Item 2");

    // Pressing Undo now restores Item 2, not Item 1
    press("Undo");

    expect(onUndo1).not.toHaveBeenCalled();
    expect(onUndo2).toHaveBeenCalledTimes(1);
  });
});
