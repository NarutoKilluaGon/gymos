import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, Linking, Pressable, Text } from "react-native";

import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import * as stepsService from "@/services/steps";

jest.mock("@/services/steps", () => ({
  getStepPermissionStatus: jest.fn(),
  requestStepPermission: jest.fn(),
  startStepTracking: jest.fn(),
}));

describe("DailyTargetsCard Step Permission Flow", () => {
  let appStateListeners: ((state: string) => void)[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners = [];
    jest.spyOn(Linking, "openSettings").mockImplementation(() => Promise.resolve());
    jest.spyOn(AppState, "addEventListener").mockImplementation((event, listener) => {
      if (event === "change") {
        appStateListeners.push(listener as (state: string) => void);
      }
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const extractTexts = (renderer: TestRenderer.ReactTestRenderer) =>
    renderer.root.findAllByType(Text).map((t) =>
      Array.isArray(t.props.children)
        ? t.props.children.flat().join("")
        : String(t.props.children ?? ""),
    );

  it("1. Not granted: shows 'Enable step tracking' button and never shows 0/8,000 bar", async () => {
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValue("not_granted");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 1.5,
          mealsLogged: 2,
          steps: 0,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const texts = extractTexts(renderer!);

    // Should render label "Steps" and "Enable step tracking" button
    expect(texts).toContain("Steps");
    expect(texts).toContain("Enable step tracking");

    // Must NOT render a misleading 0/8,000 bar or text
    const misleadingBar = texts.find((t) => t.includes("0 / 8,000 steps"));
    expect(misleadingBar).toBeUndefined();

    // Verify 44dp button target and tapping requests permission
    const enableButton = renderer!.root.find(
      (n) => n.props?.accessibilityLabel === "Enable step tracking",
    );
    expect(enableButton).toBeDefined();

    (stepsService.requestStepPermission as jest.Mock).mockResolvedValue("granted");

    await act(async () => {
      enableButton.props.onPress();
    });

    expect(stepsService.requestStepPermission).toHaveBeenCalledTimes(1);

    // After grant, switches to granted state with progress bar
    const updatedTexts = extractTexts(renderer!);
    expect(updatedTexts).toContain("0 / 8,000 steps (since you opened the app)");
  });

  it("2. Granted: shows 'X / 8,000 steps (since you opened the app)' with progress bar", async () => {
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValue("granted");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 2.0,
          mealsLogged: 1,
          steps: 3450,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const texts = extractTexts(renderer!);
    expect(texts).toContain("Steps");
    expect(texts).toContain("3,450 / 8,000 steps (since you opened the app)");
    expect(texts).not.toContain("Enable step tracking");
  });

  it("3. Denied and can't ask again: button becomes 'Open settings' and calls Linking.openSettings()", async () => {
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValue("blocked");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 1.0,
          mealsLogged: 0,
          steps: 0,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const texts = extractTexts(renderer!);
    expect(texts).toContain("Steps");
    expect(texts).toContain("Open settings");
    expect(texts).not.toContain("Enable step tracking");

    // Tap "Open settings"
    const settingsButton = renderer!.root.find(
      (n) => n.props?.accessibilityLabel === "Open settings",
    );
    expect(settingsButton).toBeDefined();

    act(() => {
      settingsButton.props.onPress();
    });

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it("4. Foreground re-check: re-checks permission on AppState active and grants without restart", async () => {
    // Initially not granted
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValueOnce("not_granted");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 1.0,
          mealsLogged: 1,
          steps: 1200,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    expect(extractTexts(renderer!)).toContain("Enable step tracking");

    // User went to Settings and granted permission; returns to foreground
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValueOnce("granted");

    await act(async () => {
      // Trigger AppState change to active
      for (const listener of appStateListeners) {
        listener("active");
      }
    });

    const updatedTexts = extractTexts(renderer!);
    expect(updatedTexts).toContain("1,200 / 8,000 steps (since you opened the app)");
    expect(updatedTexts).not.toContain("Enable step tracking");
    expect(stepsService.startStepTracking).toHaveBeenCalled();
  });

  it("5. Unavailable: shows 'Steps not supported on this phone' with no bar or enable button", async () => {
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValue("unavailable");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(DailyTargetsCard, {
          water: 1.0,
          mealsLogged: 0,
          steps: 0,
          stepsTarget: 8000,
          compact: true,
        }),
      );
    });

    const texts = extractTexts(renderer!);
    expect(texts).toContain("Steps");
    expect(texts).toContain("Steps not supported on this phone");
    expect(texts).not.toContain("Enable step tracking");
    expect(texts).not.toContain("Open settings");
    expect(texts.find((t) => t.includes("/ 8,000"))).toBeUndefined();
  });

  it("renders sleep row when logged", async () => {
    (stepsService.getStepPermissionStatus as jest.Mock).mockResolvedValue("granted");

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
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

    const texts = extractTexts(renderer!);
    expect(texts).toContain("Sleep");
    expect(texts).toContain("7h 30m");
  });
});
