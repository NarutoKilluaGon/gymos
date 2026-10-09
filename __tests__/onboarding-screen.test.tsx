import React from "react";
import { BackHandler } from "react-native";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import * as onboardingRepo from "@/storage/repositories/onboarding";
import * as nourishRepo from "@/storage/repositories/nourish-settings";
import * as forgeRepo from "@/storage/repositories/forge-settings";
import * as prefRepo from "@/storage/repositories/preferences";
import * as northStarRepo from "@/storage/repositories/north-star";

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/utils/toast", () => ({
  showToast: jest.fn(),
}));

jest.mock("@/storage/repositories/onboarding", () => ({
  setOnboardingComplete: jest.fn(async () => {}),
}));

jest.mock("@/storage/repositories/nourish-settings", () => ({
  saveNourishSettings: jest.fn(async () => {}),
}));

jest.mock("@/storage/repositories/forge-settings", () => ({
  getCustomExercises: jest.fn(async () => []),
  updateForgeSettings: jest.fn(async () => {}),
}));

jest.mock("@/storage/repositories/preferences", () => ({
  setWeightUnit: jest.fn(async () => {}),
}));

jest.mock("@/storage/repositories/north-star", () => ({
  saveNorthStar: jest.fn(async () => {}),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");

type Node = {
  type?: string;
  props?: Record<string, unknown>;
  children?: (Node | string)[] | null;
};

function renderScreen(element: React.ReactElement) {
  let renderer: {
    toJSON: () => Node | Node[] | null;
    root: {
      findAll: (
        p: (n: { props: Record<string, unknown> }) => boolean
      ) => { props: Record<string, unknown> }[];
    };
  };

  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });

  const getTexts = (): string[] => {
    const texts: string[] = [];
    const walk = (node: Node | string | null | (Node | string)[]) => {
      if (node === null || node === undefined) return;
      if (typeof node === "string") texts.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else (node.children ?? []).forEach(walk);
    };
    walk(renderer!.toJSON());
    return texts;
  };

  const press = (label: string) => {
    let pressed = false;
    TestRenderer.act(() => {
      const match = renderer!.root.findAll(
        (n) =>
          n.props.accessibilityLabel === label &&
          typeof n.props.onPress === "function"
      )[0];
      if (typeof match?.props?.onPress === "function") {
        (match.props.onPress as () => void)();
        pressed = true;
      }
    });
    return pressed;
  };

  return {
    toJSON: () => renderer.toJSON(),
    getTexts,
    press,
  };
}

describe("OnboardingScreen", () => {
  let backPressListeners: (() => boolean)[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    backPressListeners = [];
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((event, handler) => {
      if (event === "hardwareBackPress") {
        backPressListeners.push(handler as () => boolean);
      }
      return {
        remove: () => {
          backPressListeners = backPressListeners.filter((h) => h !== handler);
        },
      };
    });
  });

  it("renders step 1 (Welcome) and advances to step 2 (Goal)", () => {
    const onDone = jest.fn();
    const screen = renderScreen(<OnboardingScreen onDone={onDone} />);

    expect(screen.getTexts()).toContain("GymOS");
    expect(screen.getTexts()).toContain("Your data stays entirely on your device.");

    // Advance to step 2
    const pressed = screen.press("Get started");
    expect(pressed).toBe(true);

    expect(screen.getTexts()).toContain("What is your primary goal?");
    expect(screen.getTexts()).toContain("Build muscle");
    expect(screen.getTexts()).toContain("Lose fat");
  });

  it("supports hardware back button navigation across steps", () => {
    const onDone = jest.fn();
    const screen = renderScreen(<OnboardingScreen onDone={onDone} />);

    // On step 0, hardware back press should return false (allow exit)
    expect(backPressListeners.length).toBeGreaterThan(0);
    const initialResult = backPressListeners[backPressListeners.length - 1]();
    expect(initialResult).toBe(false);

    // Advance to step 1
    screen.press("Get started");
    expect(screen.getTexts()).toContain("What is your primary goal?");

    // Hardware back should step back to step 0 and return true (handled)
    TestRenderer.act(() => {
      const handled = backPressListeners[backPressListeners.length - 1]();
      expect(handled).toBe(true);
    });

    expect(screen.getTexts()).toContain("GymOS");
  });

  it("advances through all 5 steps and finishes onboarding", async () => {
    const onDone = jest.fn();
    const screen = renderScreen(<OnboardingScreen onDone={onDone} />);

    // Step 0: Welcome
    screen.press("Get started");

    // Step 1: Goal -> select Build muscle, press Continue
    screen.press("Build muscle");
    screen.press("Continue");
    expect(screen.getTexts()).toContain("A few details about you");

    // Step 2: About you -> press Continue
    screen.press("Continue");
    expect(screen.getTexts()).toContain("Choose your starter plan");

    // Step 3: Training -> select Push Pull Legs, press Continue
    screen.press("Push Pull Legs");
    screen.press("Continue");
    expect(screen.getTexts()).toContain("Your North Star");

    // Step 4: North Star -> press Open GymOS
    await TestRenderer.act(async () => {
      screen.press("Open GymOS");
    });

    expect(onboardingRepo.setOnboardingComplete).toHaveBeenCalledWith(true);
    expect(nourishRepo.saveNourishSettings).toHaveBeenCalled();
    expect(forgeRepo.updateForgeSettings).toHaveBeenCalled();
    expect(prefRepo.setWeightUnit).toHaveBeenCalledWith("kg");
    expect(onDone).toHaveBeenCalled();
  });

  it("allows skipping on skippable steps (About you, Training)", async () => {
    const onDone = jest.fn();
    const screen = renderScreen(<OnboardingScreen onDone={onDone} />);

    // Step 0: Welcome
    screen.press("Get started");

    // Step 1: Goal
    screen.press("Continue");

    // Step 2: About you -> Skip
    screen.press("Skip step");
    expect(screen.getTexts()).toContain("Choose your starter plan");

    // Step 3: Training -> Skip
    screen.press("Skip step");
    expect(screen.getTexts()).toContain("Your North Star");

    // Step 4: Finish
    await TestRenderer.act(async () => {
      screen.press("Open GymOS");
    });

    expect(onDone).toHaveBeenCalled();
  });
});
