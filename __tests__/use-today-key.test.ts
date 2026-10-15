import { createElement } from "react";
import { useTodayKey, msUntilNextMidnight } from "@/hooks/use-today-key";

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");
const act = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useTodayKey", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates ms until next midnight accurately", () => {
    const fixedTime = new Date(2026, 9, 14, 23, 0, 0, 0); // 11 PM
    const ms = msUntilNextMidnight(fixedTime);
    expect(ms).toBe(3600_000); // exactly 1 hour = 3,600,000 ms
  });

  it("schedules a midnight timer on mount and clears it on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");

    function Harness() {
      useTodayKey();
      return null;
    }

    let renderer: { unmount: () => void };
    act(() => {
      renderer = TestRenderer.create(createElement(Harness));
    });

    expect(setTimeoutSpy).toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
});
