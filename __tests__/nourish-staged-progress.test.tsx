import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ActivityIndicator, Text } from "react-native";
import { Button } from "@/components/nutrition/nourish-ui";
import { ReviewSheet } from "@/components/nutrition/log-sheets";
import { resolveSegments } from "@/services/nourish/resolve-log";
import type { FoodLogger } from "@/hooks/use-food-logger";
import type { DescriptionAiProvider } from "@/services/meal-description-ai-provider";

let mockReducedMotion = false;
jest.mock("@/utils/motion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("Nourish Staged Progress Sheet (Step 3)", () => {
  beforeEach(() => {
    mockReducedMotion = false;
    jest.clearAllMocks();
  });

  it("renders staged sheet immediately with estimating rows and disabled save button", () => {
    const mockLogger: Partial<FoodLogger> = {
      review: {
        slot: "Lunch",
        at: "13:00",
        dayKey: "2026-10-15",
        items: [],
        stagedSegments: [
          {
            id: "seg-1",
            segment: "chicken biryani",
            status: "estimating",
          },
        ],
        estimating: true,
        estimatingProgress: { current: 1, total: 2 },
      },
      setReview: jest.fn(),
      busy: false,
      confirm: jest.fn(),
      retrySegment: jest.fn(),
      updateStagedItem: jest.fn(),
      removeStagedSegment: jest.fn(),
      openManual: jest.fn(),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(ReviewSheet, { logger: mockLogger as FoodLogger }),
      );
    });

    const root = renderer!.root;

    // Header displays progress
    const headerTexts = root.findAllByType(Text).map((t) => t.props.children);
    expect(headerTexts).toContain("Estimating 1 of 2...");

    // Row displays food segment text and spinner
    const biryaniText = root.findAll((n) => n.props?.children === "chicken biryani");
    expect(biryaniText.length).toBeGreaterThan(0);

    // Save button disabled with label "Estimating..."
    const buttons = root.findAllByType(Button).filter((b) => b.props.label === "Estimating...");
    expect(buttons.length).toBe(1);
    expect(buttons[0]?.props.disabled).toBe(true);

    // Spinner is present when reduced motion is false
    const spinners = root.findAllByType(ActivityIndicator);
    expect(spinners.length).toBe(1);
  });

  it("shows cold-start message in header on cold start", () => {
    const mockLogger: Partial<FoodLogger> = {
      review: {
        slot: "Lunch",
        at: "13:00",
        dayKey: "2026-10-15",
        items: [],
        stagedSegments: [
          {
            id: "seg-1",
            segment: "butter chicken",
            status: "estimating",
          },
        ],
        estimating: true,
        isColdStart: true,
      },
      setReview: jest.fn(),
      busy: false,
      confirm: jest.fn(),
      retrySegment: jest.fn(),
      updateStagedItem: jest.fn(),
      removeStagedSegment: jest.fn(),
      openManual: jest.fn(),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(ReviewSheet, { logger: mockLogger as FoodLogger }),
      );
    });

    const root = renderer!.root;
    const headerTexts = root.findAllByType(Text).map((t) => t.props.children);
    expect(headerTexts).toContain("Waking up the estimator... (first one can take up to 45s)");
  });

  it("renders static dot instead of ActivityIndicator when reduced motion is active", () => {
    mockReducedMotion = true;

    const mockLogger: Partial<FoodLogger> = {
      review: {
        slot: "Lunch",
        at: "13:00",
        dayKey: "2026-10-15",
        items: [],
        stagedSegments: [
          {
            id: "seg-1",
            segment: "dal makhani",
            status: "estimating",
          },
        ],
        estimating: true,
      },
      setReview: jest.fn(),
      busy: false,
      confirm: jest.fn(),
      retrySegment: jest.fn(),
      updateStagedItem: jest.fn(),
      removeStagedSegment: jest.fn(),
      openManual: jest.fn(),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(ReviewSheet, { logger: mockLogger as FoodLogger }),
      );
    });

    const root = renderer!.root;
    const spinners = root.findAllByType(ActivityIndicator);
    expect(spinners.length).toBe(0);
  });

  it("renders failed row with retry and enter manually actions, keeping Save disabled", () => {
    const retryMock = jest.fn();
    const manualMock = jest.fn();
    const mockLogger: Partial<FoodLogger> = {
      review: {
        slot: "Dinner",
        at: "20:00",
        dayKey: "2026-10-15",
        items: [],
        stagedSegments: [
          {
            id: "seg-fail-1",
            segment: "mysterious concoction",
            status: "failed",
            error: "Couldn't estimate. Retry",
          },
        ],
        estimating: false,
      },
      setReview: jest.fn(),
      busy: false,
      confirm: jest.fn(),
      retrySegment: retryMock,
      updateStagedItem: jest.fn(),
      removeStagedSegment: jest.fn(),
      openManual: manualMock,
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(ReviewSheet, { logger: mockLogger as FoodLogger }),
      );
    });

    const root = renderer!.root;

    // Retry button triggers logger.retrySegment
    const retryNodes = root.findAll((n) => n.props?.accessibilityLabel === "Retry estimating mysterious concoction");
    expect(retryNodes.length).toBeGreaterThan(0);
    act(() => {
      retryNodes[0]?.props.onPress();
    });
    expect(retryMock).toHaveBeenCalledWith("seg-fail-1");

    // Save button remains disabled
    const saveButtons = root.findAllByType(Button).filter((b) => typeof b.props.label === "string" && b.props.label.startsWith("Save"));
    expect(saveButtons.length).toBe(1);
    expect(saveButtons[0]?.props.disabled).toBe(true);
  });
});

describe("resolveSegments concurrency and deduplication", () => {
  it("caps parallel requests to 3 and dedupes identical unknown segments", async () => {
    let activeCalls = 0;
    let maxParallel = 0;
    const callLog: string[] = [];

    const mockProvider: DescriptionAiProvider = {
      estimate: jest.fn(async (text: string) => {
        activeCalls++;
        maxParallel = Math.max(maxParallel, activeCalls);
        callLog.push(text);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeCalls--;
        return {
          foods: [
            {
              name: text,
              estimatedAmount: 1,
              unit: "plate",
              calories: 300,
              protein: 10,
              carbs: 40,
              fat: 5,
            },
          ],
          totals: {
            calories: 300,
            protein: 10,
            carbs: 40,
            fat: 5,
          },
        };
      }),
    };

    // 4 items, 2 identical: "rare dish 1", "rare dish 1", "rare dish 2", "rare dish 3"
    const text = "rare dish 1, rare dish 1, rare dish 2, rare dish 3";
    const res = await resolveSegments(text, {
      provider: mockProvider,
      saved: [],
    });

    expect(res.length).toBe(4);
    // Deduplicated: provider should only have been called 3 times (not 4)
    expect(mockProvider.estimate).toHaveBeenCalledTimes(3);
    // Max concurrency never exceeded 3
    expect(maxParallel).toBeLessThanOrEqual(3);
    // All items resolved
    expect(res.every((r) => r.status === "estimated")).toBe(true);
  });
});
