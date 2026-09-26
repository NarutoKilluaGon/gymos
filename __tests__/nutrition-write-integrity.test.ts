import {
  acknowledgePendingDescriptionReviewByDescription,
  canPresentPendingDescriptionReview,
  retryPendingDescription,
} from "@/services/description-ai-queue";
import {
  computeMealTotals,
  mealInputForSave,
  mealInputFromRecentMeal,
  resolveMealDescriptionWithProviderStaged,
  toCanonicalMealNutrition,
  type DescriptionAiProvider,
} from "@/services/meal-estimator";
import {
  addSavedFood,
  getSavedFoods,
} from "@/storage/repositories/saved-foods";
import {
  clearPendingDescriptionAnalyses,
  enqueuePendingDescriptionAnalysis,
  getPendingDescriptionAnalyses,
} from "@/storage/repositories/description-ai-queue";
import type { Meal, MealFood } from "@/types/gymos";

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
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __reset(): void;
};

const sparseFood: MealFood = {
  name: "Legacy food",
  amount: 1,
  unit: "serving",
  calories: 200,
  protein: 20,
  carbs: 30,
  fat: 8,
};

const legacyMicros = {
  fiber: 8,
  vitaminD: 0.2,
  folate: 40,
};

const completeAiNutrition = {
  calories: 200,
  protein: 20,
  carbs: 30,
  fat: 8,
  fiber: 8,
  sodium: 100,
  potassium: 200,
  calcium: 50,
  iron: 2,
  magnesium: 20,
  zinc: 1,
  vitaminA: 10,
  vitaminC: 5,
  vitaminD: 0.2,
  vitaminB12: 0.5,
  folate: 40,
};

function reviewInput() {
  const derivedTotals = computeMealTotals([sparseFood]);

  return mealInputForSave({
    name: "Legacy meal",
    displayedTotals: {
      calories: derivedTotals.calories,
      protein: derivedTotals.protein,
      carbs: derivedTotals.carbs,
      fat: derivedTotals.fat,
    },
    derivedTotals,
    foods: [sparseFood],
    fallbackMicronutrients: legacyMicros,
  });
}

beforeEach(async () => {
  storageMock.__reset();
  await clearPendingDescriptionAnalyses();
});

describe("Nutrition write/review integrity", () => {
  it("preserves flat micronutrients when legacy food rows are sparse on edit", () => {
    const nutrition = toCanonicalMealNutrition(reviewInput());

    expect(nutrition.fiber).toBe(8);
    expect(nutrition.vitaminD).toBe(0.2);
    expect(nutrition.folate).toBe(40);
  });

  it("keeps represented food micros ahead of the legacy fallback", () => {
    const food: MealFood = {
      ...sparseFood,
      fiber: 2,
    };
    const input = mealInputForSave({
      name: "Legacy meal",
      displayedTotals: {
        calories: 200,
        protein: 20,
        carbs: 30,
        fat: 8,
      },
      derivedTotals: computeMealTotals([food]),
      foods: [food],
      fallbackMicronutrients: legacyMicros,
    });

    expect(input.fiber).toBe(2);
    expect(input.vitaminD).toBe(0.2);
  });

  it("preserves flat micronutrients for totals-only edit input", () => {
    const input = mealInputForSave({
      name: "Legacy totals-only meal",
      displayedTotals: {
        calories: 200,
        protein: 20,
        carbs: 30,
        fat: 8,
      },
      derivedTotals: null,
      fallbackMicronutrients: legacyMicros,
    });

    const nutrition = toCanonicalMealNutrition(input);

    expect(nutrition.fiber).toBe(8);
    expect(nutrition.vitaminD).toBe(0.2);
    expect(nutrition.folate).toBe(40);
  });

  it("preserves flat micronutrients when saving the same legacy input for reuse", async () => {
    const input = reviewInput();
    const nutrition = toCanonicalMealNutrition(input);
    const saved = await addSavedFood(
      input.name,
      nutrition,
      input.foods,
    );

    expect(saved.fiber).toBe(8);
    expect(saved.vitaminD).toBe(0.2);
    expect(saved.folate).toBe(40);
  });

  it("preserves stored micronutrients when repeating a recent meal", () => {
    const meal: Meal = {
      id: "legacy-meal",
      name: "Legacy meal",
      timestamp: "2026-09-24T08:00:00.000Z",
      calories: 200,
      protein: 20,
      carbs: 30,
      fat: 8,
      ...legacyMicros,
      foods: [sparseFood],
    };

    const nutrition = toCanonicalMealNutrition(
      mealInputFromRecentMeal(meal),
    );

    expect(nutrition.fiber).toBe(8);
    expect(nutrition.vitaminD).toBe(0.2);
    expect(nutrition.folate).toBe(40);
  });

  it("serializes concurrent reusable saves without losing existing records", async () => {
    await addSavedFood("Existing", { calories: 100 });

    await Promise.all([
      addSavedFood("First", { calories: 200 }),
      addSavedFood("Second", { calories: 300 }),
    ]);

    const saved = await getSavedFoods();
    expect(saved.map((food) => food.name)).toEqual([
      "Existing",
      "First",
      "Second",
    ]);
  });

  it("reconciles a successful direct description with matching queued work", async () => {
    const description = "  Dragon   fruit protein bar XYZ  ";
    const item = await enqueuePendingDescriptionAnalysis(description);
    const provider: DescriptionAiProvider = {
      estimate: async () => ({
        foods: [
          {
            name: "Dragon fruit protein bar XYZ",
            estimatedAmount: 1,
            unit: "serving",
            ...completeAiNutrition,
          },
        ],
        totals: completeAiNutrition,
      }),
    };

    const direct = await resolveMealDescriptionWithProviderStaged(
      description,
      undefined,
      undefined,
      undefined,
      provider,
    );

    expect(direct.status).toBe("resolved");
    expect(
      await acknowledgePendingDescriptionReviewByDescription(
        "dragon FRUIT protein bar xyz",
      ),
    ).toBe(1);
    expect(await getPendingDescriptionAnalyses()).toEqual([]);
    expect(item.status).toBe("pending");
  });

  it("does not present or acknowledge retries without a review surface", () => {
    const available = {
      screenMounted: true,
      screenFocused: true,
      nutritionEnabled: true,
      addMealOpen: false,
      mealSheetOpen: false,
    };

    expect(canPresentPendingDescriptionReview(available)).toBe(true);
    expect(
      canPresentPendingDescriptionReview({
        ...available,
        nutritionEnabled: false,
      }),
    ).toBe(false);
    expect(
      canPresentPendingDescriptionReview({
        ...available,
        addMealOpen: true,
      }),
    ).toBe(false);
    expect(
      canPresentPendingDescriptionReview({
        ...available,
        screenMounted: false,
      }),
    ).toBe(false);
    expect(
      canPresentPendingDescriptionReview({
        ...available,
        screenFocused: false,
      }),
    ).toBe(false);
  });

  it("leaves a pending item durable when handoff cannot be acknowledged", async () => {
    const item = await enqueuePendingDescriptionAnalysis(
      "Mystery food awaiting review",
    );
    const provider: DescriptionAiProvider = {
      estimate: async () => ({
        foods: [
          {
            name: "Mystery food",
            estimatedAmount: 1,
            unit: "serving",
            ...completeAiNutrition,
          },
        ],
        totals: completeAiNutrition,
      }),
    };

    const result = await retryPendingDescription(item.id, { provider });

    expect(result.status).toBe("review");
    expect(await getPendingDescriptionAnalyses()).toEqual([item]);
  });
});
