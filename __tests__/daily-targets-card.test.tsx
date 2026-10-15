import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";

describe("DailyTargetsCard row labels and layout", () => {
  it("renders distinct, labeled rows for Water, Sleep, and Steps in compact mode", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 1.5,
          mealsLogged: 2,
          sleep: undefined, // empty sleep
          steps: 4200,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) =>
      Array.isArray(t.props.children)
        ? t.props.children.flat().join("")
        : String(t.props.children ?? ""),
    );

    // Verify all rows have their own dedicated label
    expect(texts).toContain("Water");
    expect(texts).toContain("Sleep");
    expect(texts).toContain("Steps");

    // Sleep row renders placeholder when no sleep logged
    expect(texts).toContain("—");

    // Steps row renders value and unit
    const stepsValueText = texts.find(
      (t) => typeof t === "string" && t.includes("4,200 / 8,000 steps"),
    );
    expect(stepsValueText).toBeDefined();

    // Water row renders value and unit
    const waterValueText = texts.find(
      (t) => typeof t === "string" && t.includes("1.5 / 3.5 L"),
    );
    expect(waterValueText).toBeDefined();
  });

  it("renders formatted sleep duration in Sleep row when logged", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 2.0,
          mealsLogged: 3,
          sleep: "7h 30m",
          steps: 8500,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) =>
      Array.isArray(t.props.children)
        ? t.props.children.flat().join("")
        : String(t.props.children ?? ""),
    );

    expect(texts).toContain("Sleep");
    expect(texts).toContain("7h 30m");
    expect(texts).toContain("Steps");
  });
});
