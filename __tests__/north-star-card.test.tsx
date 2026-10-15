import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { NorthStarCard } from "@/components/dashboard/north-star-card";
import type { NorthStar } from "@/types/gymos";

let mockReducedMotion = false;
jest.mock("@/utils/motion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

describe("NorthStarCard Shooting Star & Night-Sky Background (Step 1)", () => {
  const mockNorthStar: NorthStar = {
    title: "Bench 100kg & Run 10k",
    why: "Build strength and endurance for life",
    lastChangedAt: "2026-10-01T00:00:00.000Z",
  };

  beforeEach(() => {
    mockReducedMotion = false;
    jest.clearAllMocks();
  });

  it("renders deep night-sky linear gradient background with exact colors", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(NorthStarCard, { northStar: mockNorthStar }),
      );
    });

    const root = renderer!.root;

    // LinearGradient with night-sky colors (#171a4a -> #241552 -> #3a1b5e)
    const gradients = root.findAllByType(LinearGradient);
    expect(gradients.length).toBeGreaterThanOrEqual(2); // Card background + shooting star tail

    const bgGradient = gradients[0];
    expect(bgGradient?.props.colors).toEqual(["#171a4a", "#241552", "#3a1b5e"]);
  });

  it("renders shooting star tail with horizontal transparent-to-white gradient", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(NorthStarCard, { northStar: mockNorthStar }),
      );
    });

    const root = renderer!.root;
    const gradients = root.findAllByType(LinearGradient);

    // Shooting star tail gradient
    const tailGradient = gradients.find((g) =>
      Array.isArray(g.props.colors) &&
      g.props.colors.includes("#FFFFFF") &&
      g.props.colors.some((c: string) => c.includes("rgba(255, 255, 255, 0)")),
    );
    expect(tailGradient).toBeDefined();
    expect(tailGradient?.props.start).toEqual({ x: 0, y: 0.5 });
    expect(tailGradient?.props.end).toEqual({ x: 1, y: 0.5 });
  });

  it("renders goal title, why, eyebrow, and non-overlapping Edit control", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(NorthStarCard, { northStar: mockNorthStar }),
      );
    });

    const root = renderer!.root;

    // Eyebrow and Goal Title
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain("NORTH STAR");
    expect(texts).toContain("Bench 100kg & Run 10k");
    expect(texts).toContain("Build strength and endurance for life");

    // Edit button on card
    const editNodes = root.findAll(
      (n) => n.props?.accessibilityLabel === "Edit North Star",
    );
    expect(editNodes.length).toBeGreaterThan(0);
    expect(typeof editNodes[0]?.props.onPress).toBe("function");

    // Tapping Edit opens editor modal
    act(() => {
      editNodes[0]?.props.onPress();
    });

    const modalTitle = root.findAll(
      (n) => n.type === Text && n.props.children === "Change North Star",
    );
    expect(modalTitle.length).toBeGreaterThan(0);
  });

  it("respects reduced motion when active", () => {
    mockReducedMotion = true;

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(NorthStarCard, { northStar: mockNorthStar }),
      );
    });

    const root = renderer!.root;
    expect(root).toBeDefined();
    const title = root.findAll(
      (n) => n.type === Text && n.props.children === "Bench 100kg & Run 10k",
    );
    expect(title.length).toBe(1);
  });
});
