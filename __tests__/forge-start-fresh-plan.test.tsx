import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";

import { useForge } from "@/hooks/use-forge";
import { updateForgeSettings } from "@/storage/repositories/forge-settings";
import type { ForgeSettings, Plan } from "@/types/forge";
import { showToast } from "@/utils/toast";

// Run the focus effect once on mount so the hook loads like it does on screen.
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").useEffect(callback, [callback]),
}));
jest.mock("@/hooks/use-weight-unit", () => ({ useWeightUnit: () => ({ unit: "kg" }) }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const planWith = (names: string[]): Plan => ({
  id: "p1",
  name: "Plan",
  days: [
    {
      id: "d1",
      name: "Push",
      exercises: names.map((name) => ({
        exerciseId: name,
        name,
        sets: 3,
        reps: "8-10",
        weight: 0,
      })),
    },
  ],
  schedule: {},
  rotate: true,
  deload: false,
  updatedAt: "2026-03-01T00:00:00.000Z",
});

const settingsWith = (plan: Plan | null): ForgeSettings => ({
  plans: plan ? [plan] : [],
  activePlanId: plan?.id ?? "",
  restSeconds: 90,
  barKg: 20,
  routinesImported: true,
});

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function mount() {
  const result = { current: undefined as unknown as ReturnType<typeof useForge> };
  let renderer!: { unmount: () => void };

  function Harness() {
    result.current = useForge();

    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(createElement(Harness));
  });
  await settle();

  return { result, unmount: () => act(() => renderer.unmount()) };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  (showToast as jest.Mock).mockClear();
});

describe("Forge Start uses the stored plan, not the loaded copy", () => {
  it("starts from a plan edited after this screen loaded", async () => {
    await updateForgeSettings(() => settingsWith(planWith(["Test Squat"])));

    const { result, unmount } = await mount();

    expect(result.current.data?.settings.plans[0]?.days[0]?.exercises).toHaveLength(1);

    // Changed in storage behind the loaded copy (a save whose reload has not
    // landed yet, or an edit made elsewhere).
    await updateForgeSettings(() => settingsWith(planWith(["Test Squat", "Test Lunge"])));

    let session: Awaited<ReturnType<typeof result.current.actions.begin>> = null;

    await act(async () => {
      session = await result.current.actions.begin({ dayId: "d1" });
    });

    expect(session).not.toBeNull();
    expect(
      (session as unknown as { exercises: { name: string }[] }).exercises.map((e) => e.name),
    ).toEqual(["Test Squat", "Test Lunge"]);

    await unmount();
  });

  it("does not start a day that was deleted after the screen loaded", async () => {
    await updateForgeSettings(() => settingsWith(planWith(["Test Squat"])));

    const { result, unmount } = await mount();

    await updateForgeSettings(() => settingsWith({ ...planWith([]), days: [] }));

    let session: Awaited<ReturnType<typeof result.current.actions.begin>> = null;

    await act(async () => {
      session = await result.current.actions.begin({ dayId: "d1" });
    });

    // The deleted day resolves to nothing, so no stale routine is loaded.
    expect(
      (session as unknown as { exercises: unknown[] } | null)?.exercises,
    ).toEqual([]);

    await unmount();
  });
});
