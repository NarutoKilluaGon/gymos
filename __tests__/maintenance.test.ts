import {
  ACTIVITY_LEVELS,
  estimateMaintenanceCalories,
} from "@/services/calorie-target";
import {
  calculateCalorieTarget,
  DEFAULT_GOAL_ADJUSTMENT_KCAL,
} from "@/services/calorie-target";
import {
  getNutritionProfile,
  saveNutritionProfile,
} from "@/storage/repositories/nutrition-profile";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
  };

  return {
    getStorage: jest.fn(async (key: string): Promise<unknown> => {
      const raw = state.store[key];
      return raw === undefined ? null : JSON.parse(raw);
    }),
    setStorage: jest.fn(
      async (key: string, value: unknown): Promise<void> => {
        state.store[key] = JSON.stringify(value);
      },
    ),
    removeStorage: jest.fn(async (key: string): Promise<void> => {
      delete state.store[key];
    }),
    StorageError: class StorageError extends Error {},
    __reset() {
      state.store = {};
    },
    __seed(key: string, value: unknown) {
      state.store[key] = JSON.stringify(value);
    },
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __reset(): void;
  __seed(key: string, value: unknown): void;
};

beforeEach(() => {
  storageMock.__reset();
});

describe("maintenance calculator (Mifflin-St Jeor × activity)", () => {
  it("(A) computes male maintenance from all five inputs", () => {
    // BMR = 10×80 + 6.25×180 − 5×30 + 5 = 1780; ×1.2 sedentary.
    expect(
      estimateMaintenanceCalories({
        ageYears: 30,
        sex: "male",
        heightCm: 180,
        weightKg: 80,
        activityLevel: "sedentary",
      }),
    ).toBe(2136);
  });

  it("(A) computes female maintenance from all five inputs", () => {
    // BMR = 10×60 + 6.25×165 − 5×30 − 161 = 1320.25; ×1.375 light.
    expect(
      estimateMaintenanceCalories({
        ageYears: 30,
        sex: "female",
        heightCm: 165,
        weightKg: 60,
        activityLevel: "light",
      }),
    ).toBe(1815);
  });

  it("(A) scales with the activity ladder, never double-counting", () => {
    const base = {
      ageYears: 30,
      sex: "male" as const,
      heightCm: 180,
      weightKg: 80,
    };

    // Same body, increasing everyday activity only.
    expect(
      estimateMaintenanceCalories({ ...base, activityLevel: "moderate" }),
    ).toBe(2759);
    expect(
      estimateMaintenanceCalories({ ...base, activityLevel: "very" }),
    ).toBeGreaterThan(2759);

    // The multipliers are the documented standard factors.
    expect(
      ACTIVITY_LEVELS.map((entry) => [
        entry.value,
        entry.multiplier,
      ]),
    ).toEqual([
      ["sedentary", 1.2],
      ["light", 1.375],
      ["moderate", 1.55],
      ["very", 1.725],
    ]);
  });

  it("(A) returns null unless every input is present and plausible", () => {
    const full = {
      ageYears: 30,
      sex: "male" as const,
      heightCm: 180,
      weightKg: 80,
      activityLevel: "sedentary" as const,
    };

    expect(estimateMaintenanceCalories({})).toBeNull();
    expect(
      estimateMaintenanceCalories({ ...full, sex: undefined }),
    ).toBeNull();
    expect(
      estimateMaintenanceCalories({ ...full, activityLevel: undefined }),
    ).toBeNull();
    expect(
      estimateMaintenanceCalories({ ...full, activityLevel: "extreme" }),
    ).toBeNull();
    expect(
      estimateMaintenanceCalories({ ...full, sex: "other" }),
    ).toBeNull();

    // Out-of-range values never produce a number.
    for (const bad of [
      { ...full, ageYears: 9 },
      { ...full, ageYears: 101 },
      { ...full, heightCm: 99 },
      { ...full, heightCm: 251 },
      { ...full, weightKg: 24 },
      { ...full, weightKg: 401 },
      { ...full, ageYears: Number.NaN },
      { ...full, weightKg: "80" },
    ]) {
      expect(estimateMaintenanceCalories(bad)).toBeNull();
    }

    // Boundary values are accepted.
    expect(
      estimateMaintenanceCalories({
        ...full,
        ageYears: 10,
        heightCm: 100,
        weightKg: 25,
      }),
    ).toBeGreaterThan(0);
    expect(
      estimateMaintenanceCalories({
        ...full,
        ageYears: 100,
        heightCm: 250,
        weightKg: 400,
      }),
    ).toBeGreaterThan(0);
  });

  it("persists the calculation inputs for later recalculation", async () => {
    await saveNutritionProfile({
      ageYears: 30,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "sedentary",
    });

    await expect(getNutritionProfile()).resolves.toEqual({
      ageYears: 30,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "sedentary",
    });
  });

  it("(B–E) calculated maintenance feeds the unchanged goal engine", () => {
    const maintenance = estimateMaintenanceCalories({
      ageYears: 30,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "sedentary",
    })!; // 2136

    // Maintain → target equals maintenance.
    expect(
      calculateCalorieTarget({
        maintenanceCalories: maintenance,
        goal: "maintain",
        timelineItems: [],
        todayKey: "2026-09-24",
      }).targetKcal,
    ).toBe(2136);

    // Deficit → maintenance minus adjustment (default 500).
    expect(
      calculateCalorieTarget({
        maintenanceCalories: maintenance,
        goal: "deficit",
        timelineItems: [],
        todayKey: "2026-09-24",
      }).targetKcal,
    ).toBe(2136 - DEFAULT_GOAL_ADJUSTMENT_KCAL);

    // Surplus with an explicit adjustment.
    expect(
      calculateCalorieTarget({
        maintenanceCalories: maintenance,
        goal: "surplus",
        goalAdjustmentKcal: 250,
        timelineItems: [],
        todayKey: "2026-09-24",
      }).targetKcal,
    ).toBe(2136 + 250);
  });
});
