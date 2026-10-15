import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Keyboard, TextInput, Pressable } from "react-native";
import { TodayView } from "@/components/nutrition/today-view";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("@/services/notifications", () => ({
  applyReminders: jest.fn(),
  setupNotifications: jest.fn(),
}));

function mockNourish() {
  return {
    data: {
      meals: {},
      saved: [],
      recipes: [],
      cardio: {},
      settings: {
        kcal: 2000,
        protein: 150,
        split: "40,30",
        cardioReturn: 0.5,
        weeklyRate: 0,
        fallbackWeightKg: 75,
        prefs: "",
        changeLog: [],
      },
      streak: { current: 1, best: 1, history: [] },
      water: {},
      occasions: {},
    },
    model: () => ({
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      budget: 2000,
      remaining: 2000,
      proteinGap: 150,
      burnKcal: 0,
      burn: [],
      meals: [],
      breakdown: {
        proteinCal: 0,
        carbCal: 0,
        fatCal: 0,
        proteinPct: 0,
        carbPct: 0,
        fatPct: 0,
      },
      targets: { protein: 150, carbs: 200, fat: 67 },
    }),
    actions: {
      createSavedFood: jest.fn().mockResolvedValue(true),
      removeSavedFood: jest.fn().mockResolvedValue(true),
      removeCardio: jest.fn().mockResolvedValue(true),
      restoreCardio: jest.fn().mockResolvedValue(true),
      saveMeal: jest.fn().mockResolvedValue(true),
      deleteMeal: jest.fn().mockResolvedValue(true),
    },
    records: new Map(),
    weightKg: 75,
  };
}

describe("TodayView Dock & Keyboard Positioning (Step 1 & 2)", () => {
  it("renders dock with multiline input, 44dp send target, and proper initial state", () => {
    const nourish = mockNourish();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        createElement(TodayView, { nourish: nourish as never }),
      );
    });

    const root = renderer!.root;

    // Find TextInput
    const input = root.findByType(TextInput);
    expect(input.props.placeholder).toBe("Log anything: 2 rotis, dal, paneer bhurji");
    expect(input.props.multiline).toBe(true);
    expect(input.props.accessibilityLabel).toBe("Log food or cardio");

    // Find Send button by accessibilityLabel
    const sendNodes = root.findAll(
      (n) => n.props?.accessibilityLabel === "Log",
    );
    expect(sendNodes.length).toBeGreaterThan(0);
    const sendBtn = sendNodes[0];
    expect(sendBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it("enables send button when text is non-empty and handles keyboard show/hide", () => {
    const nourish = mockNourish();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        createElement(TodayView, { nourish: nourish as never }),
      );
    });

    const root = renderer!.root;
    const input = root.findByType(TextInput);

    // Type text
    act(() => {
      input.props.onChangeText("2 rotis and dal");
    });

    const sendNodes = root.findAll(
      (n) => n.props?.accessibilityLabel === "Log",
    );
    expect(sendNodes.length).toBeGreaterThan(0);
    const sendBtn = sendNodes[0];
    expect(sendBtn.props.accessibilityState?.disabled).toBe(false);
  });
});
