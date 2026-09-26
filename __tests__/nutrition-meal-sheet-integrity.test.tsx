import React, { useState } from "react";
import { TextInput } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { MealSheet } from "@/components/quick-add/meal-sheet";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
  },
  NotificationFeedbackType: {
    Error: "error",
    Success: "success",
  },
}));

jest.mock("lucide-react-native", () => ({
  X: () => null,
}));

jest.mock("@/constants/theme", () => ({
  GymColors: {
    background: {
      primary: "#000",
      surface: "#111",
      card: "#222",
    },
    text: {
      primary: "#fff",
      secondary: "#ddd",
      tertiary: "#aaa",
    },
    semantic: {
      accent: "#0f0",
      success: "#0f0",
      warning: "#ff0",
    },
  },
  Radius: {
    extraLarge: 1,
    medium: 1,
  },
  Spacing: {
    half: 1,
    one: 2,
    two: 4,
    three: 8,
    four: 12,
    five: 16,
    six: 20,
  },
  Typography: {
    body: 16,
    caption: 12,
    h1: 32,
    h2: 24,
    h3: 20,
  },
}));

jest.mock("@/utils/toast", () => ({
  showToast: jest.fn(),
}));

type Renderer = TestRenderer.ReactTestRenderer;

let renderer: Renderer | undefined;

function initialMeal() {
  return {
    name: "Legacy meal",
    calories: 200,
    protein: 20,
    carbs: 30,
    fat: 8,
  };
}

function findByAccessibilityLabel(
  root: TestRenderer.ReactTestInstance,
  label: string,
): TestRenderer.ReactTestInstance {
  return root.find(
    (node) => node.props?.accessibilityLabel === label,
  );
}

function inputWithValue(
  root: TestRenderer.ReactTestInstance,
  value: string,
): TestRenderer.ReactTestInstance {
  return root.find(
    (node) =>
      node.type === TextInput && node.props?.value === value,
  );
}

async function press(node: TestRenderer.ReactTestInstance) {
  await act(async () => {
    node.props.onPress?.();
    await Promise.resolve();
  });
}

afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
    renderer = undefined;
  }
});

describe("MealSheet save integrity", () => {
  it("retains the entered form when persistence rejects", async () => {
    const onSave = jest.fn(async () => {
      throw new Error("storage unavailable");
    });

    await act(async () => {
      renderer = TestRenderer.create(
        <MealSheet
          visible
          onClose={jest.fn()}
          onSave={onSave}
          initialMeal={initialMeal()}
        />,
      );
    });

    await press(
      findByAccessibilityLabel(renderer!.root, "Log meal"),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      inputWithValue(renderer!.root, "Legacy meal"),
    ).toBeTruthy();
    expect(inputWithValue(renderer!.root, "200")).toBeTruthy();
  });

  it("clears the form and lets the parent close after successful persistence", async () => {
    const onSave = jest.fn(async (_meal: unknown) => true);

    function Harness() {
      const [visible, setVisible] = useState(true);

      return (
        <MealSheet
          visible={visible}
          onClose={() => setVisible(false)}
          onSave={async (meal) => {
            const result = await onSave(meal);
            if (result) {
              setVisible(false);
            }
            return result;
          }}
          initialMeal={initialMeal()}
        />
      );
    }

    await act(async () => {
      renderer = TestRenderer.create(<Harness />);
    });

    await press(
      findByAccessibilityLabel(renderer!.root, "Log meal"),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(() =>
      inputWithValue(renderer!.root, "Legacy meal"),
    ).toThrow();
  });

  it("signals a review only after the visible sheet has rendered", async () => {
    const onReviewPresented = jest.fn();

    await act(async () => {
      renderer = TestRenderer.create(
        <MealSheet
          visible
          onClose={jest.fn()}
          onSave={jest.fn()}
          onReviewPresented={onReviewPresented}
          initialMeal={initialMeal()}
        />,
      );
    });

    expect(onReviewPresented).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.update(
        <MealSheet
          visible={false}
          onClose={jest.fn()}
          onSave={jest.fn()}
          onReviewPresented={onReviewPresented}
          initialMeal={initialMeal()}
        />,
      );
    });

    expect(onReviewPresented).toHaveBeenCalledTimes(1);
  });

  it("guards rapid repeated save taps while persistence is in flight", async () => {
    let resolveSave: ((value: boolean) => void) | undefined;
    const onSave = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
    );

    await act(async () => {
      renderer = TestRenderer.create(
        <MealSheet
          visible
          onClose={jest.fn()}
          onSave={onSave}
          initialMeal={initialMeal()}
        />,
      );
    });

    const saveButton = findByAccessibilityLabel(
      renderer!.root,
      "Log meal",
    );

    await act(async () => {
      void saveButton.props.onPress?.();
      void saveButton.props.onPress?.();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave?.(true);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
