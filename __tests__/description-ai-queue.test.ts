import {
  acknowledgePendingDescriptionReview,
  enqueueDescriptionAiNetworkFailure,
  retryPendingDescription,
  retryPendingDescriptions,
} from "@/services/description-ai-queue";
import {
  clearPendingDescriptionAnalyses,
  enqueuePendingDescriptionAnalysis,
  getPendingDescriptionAnalyses,
} from "@/storage/repositories/description-ai-queue";
import {
  DescriptionAiError,
  resetDescriptionAiProvider,
  resolveMealDescriptionWithProviderStaged,
  setDescriptionAiProvider,
  type DescriptionAiProvider,
  type MealEstimate,
} from "@/services/meal-estimator";

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

const nutrients = {
  calories: 300,
  protein: 20,
  carbs: 30,
  fat: 10,
  fiber: 3,
  sodium: 150,
  potassium: 200,
  calcium: 40,
  iron: 1,
  magnesium: 15,
  zinc: 0.5,
  vitaminA: 20,
  vitaminC: 5,
  vitaminD: 0.2,
  vitaminB12: 0.4,
  folate: 12,
};

function aiFood(
  overrides: Partial<MealEstimate["foods"][number]> = {},
): MealEstimate["foods"][number] {
  return {
    name: "Dragon fruit protein bar XYZ",
    estimatedAmount: 1,
    unit: "serving",
    ...nutrients,
    ...overrides,
  };
}

function estimateWith(
  foods: MealEstimate["foods"],
): MealEstimate {
  return {
    foods,
    totals: {
      calories: foods.reduce((sum, food) => sum + food.calories, 0),
      protein: foods.reduce((sum, food) => sum + food.protein, 0),
      carbs: foods.reduce((sum, food) => sum + food.carbs, 0),
      fat: foods.reduce((sum, food) => sum + food.fat, 0),
    },
  };
}

function providerReturning(
  foods: MealEstimate["foods"],
): DescriptionAiProvider & { estimate: jest.Mock } {
  return {
    estimate: jest.fn(async () => estimateWith(foods)),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  storageMock.__reset();
  await clearPendingDescriptionAnalyses();
  resetDescriptionAiProvider();
});

afterEach(() => {
  resetDescriptionAiProvider();
});

describe("description AI offline queue", () => {
  it("creates a pending item only for a network failure", async () => {
    const network = await enqueueDescriptionAiNetworkFailure(
      "  dragon fruit protein bar XYZ  ",
      new DescriptionAiError("network", "offline"),
    );
    const http = await enqueueDescriptionAiNetworkFailure(
      "http failure description",
      new DescriptionAiError("http", "unavailable", 503),
    );

    expect(network).toMatchObject({
      description: "  dragon fruit protein bar XYZ  ",
      status: "pending",
      retryCount: 0,
    });
    expect(http).toBeNull();
    expect(await getPendingDescriptionAnalyses()).toHaveLength(1);
  });

  it("persists the exact description across reads/reload boundaries", async () => {
    const description =
      "  10 eggs + 200g cooked rice + 150g curd  ";
    const item = await enqueuePendingDescriptionAnalysis(description);

    // A fresh repository read is the persistence boundary used by app
    // restart; no in-memory queue state is required.
    const reloaded = await getPendingDescriptionAnalyses();

    expect(reloaded).toEqual([item]);
    expect(reloaded[0].description).toBe(description);
  });

  it("prevents duplicate descriptions while preserving multiple items", async () => {
    const first = await enqueuePendingDescriptionAnalysis(
      "Dragon fruit protein bar XYZ",
    );
    const duplicate = await enqueuePendingDescriptionAnalysis(
      "  dragon   fruit protein bar xyz  ",
    );
    const second = await enqueuePendingDescriptionAnalysis(
      "Mystery granola clusters",
    );

    expect(duplicate.id).toBe(first.id);
    expect((await getPendingDescriptionAnalyses()).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("retries through the existing provider and keeps the item until review ack", async () => {
    const item = await enqueuePendingDescriptionAnalysis(
      "200g cooked rice",
    );
    const provider = providerReturning([
      aiFood({
        name: "Cooked rice",
        estimatedAmount: 200,
        unit: "g",
        calories: 999,
        protein: 99,
      }),
    ]);

    const result = await retryPendingDescription(item.id, { provider });

    if (result.status !== "review") {
      throw new Error("expected review handoff");
    }

    expect(provider.estimate).toHaveBeenCalledWith("200g cooked rice");
    expect(result.estimate.foods[0]).toMatchObject({
      name: "Cooked rice",
      entryId: "cooked-rice",
      calories: 260,
      nutritionSource: "food-db",
    });
    expect(await getPendingDescriptionAnalyses()).toHaveLength(1);

    await acknowledgePendingDescriptionReview(item.id);
    expect(await getPendingDescriptionAnalyses()).toEqual([]);
  });

  it("keeps an item pending after a network retry failure", async () => {
    const item = await enqueuePendingDescriptionAnalysis(
      "Mystery food while offline",
    );
    const provider: DescriptionAiProvider = {
      estimate: jest.fn(async () => {
        throw new DescriptionAiError("network", "still offline");
      }),
    };

    const result = await retryPendingDescription(item.id, { provider });

    expect(result.status).toBe("pending");
    expect(await getPendingDescriptionAnalyses()).toEqual([
      expect.objectContaining({
        id: item.id,
        status: "pending",
        retryCount: 1,
        lastErrorCode: "network",
      }),
    ]);
  });

  it("moves non-network/invalid failures out of automatic retry", async () => {
    const item = await enqueuePendingDescriptionAnalysis(
      "Mystery food with invalid provider result",
    );
    const provider: DescriptionAiProvider = {
      estimate: jest.fn(async () => {
        throw new DescriptionAiError("http", "provider unavailable", 503);
      }),
    };

    const first = await retryPendingDescription(item.id, { provider });
    expect(first.status).toBe("needs-attention");

    const automatic = await retryPendingDescriptions({ provider });
    expect(automatic.results).toEqual([]);
    expect(provider.estimate).toHaveBeenCalledTimes(1);
    expect((await getPendingDescriptionAnalyses())[0].status).toBe(
      "needs-attention",
    );

    const invalidItem = await enqueuePendingDescriptionAnalysis(
      "Another mystery food",
    );
    const invalidProvider: DescriptionAiProvider = {
      estimate: jest.fn(async () => {
        throw new DescriptionAiError(
          "invalid-response",
          "bad response",
        );
      }),
    };
    const invalid = await retryPendingDescription(invalidItem.id, {
      provider: invalidProvider,
    });
    expect(invalid.status).toBe("needs-attention");
    expect(
      (await getPendingDescriptionAnalyses()).find(
        (candidate) => candidate.id === invalidItem.id,
      )?.status,
    ).toBe("needs-attention");
  });

  it("processes multiple pending descriptions one review handoff at a time", async () => {
    const first = await enqueuePendingDescriptionAnalysis(
      "First mystery food",
    );
    const second = await enqueuePendingDescriptionAnalysis(
      "Second mystery food",
    );
    const provider = providerReturning([aiFood()]);

    const firstPass = await retryPendingDescriptions({ provider });
    expect(firstPass.results).toHaveLength(1);
    expect(firstPass.results[0].status).toBe("review");
    expect(await getPendingDescriptionAnalyses()).toHaveLength(2);

    const review = firstPass.results[0];
    if (review.status !== "review") {
      throw new Error("expected first review");
    }
    await acknowledgePendingDescriptionReview(review.item.id);

    const secondPass = await retryPendingDescriptions({ provider });
    expect(secondPass.results[0]?.status).toBe("review");
    expect((await getPendingDescriptionAnalyses()).map((item) => item.id)).toEqual([
      second.id,
    ]);
  });

  it("leaves no-provider behavior local and does not invent a queue item", async () => {
    setDescriptionAiProvider(null);
    const local = await resolveMealDescriptionWithProviderStaged(
      "150g curd",
      undefined,
      undefined,
      undefined,
      null,
    );

    if (local.status !== "resolved") {
      throw new Error("expected local estimate");
    }

    expect(local.estimate.foods[0]).toMatchObject({
      entryId: "curd",
      nutritionSource: "food-db",
    });
    expect(await retryPendingDescriptions({ provider: null })).toEqual({
      results: [],
    });
    expect(await getPendingDescriptionAnalyses()).toEqual([]);
  });
});
