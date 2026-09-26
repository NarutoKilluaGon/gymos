import {
  applyFoodDbPrecedence,
  createRenderDescriptionAiProvider,
  DescriptionAiError,
  resetDescriptionAiProvider,
  resolveMealDescriptionWithProviderStaged,
  setDescriptionAiProvider,
  type DescriptionAiProvider,
  type MealEstimate,
} from "@/services/meal-estimator";

const AI_NUTRIENTS = {
  calories: 321,
  protein: 22,
  carbs: 31,
  fat: 12,
  fiber: 4,
  sodium: 180,
  potassium: 240,
  calcium: 55,
  iron: 1.2,
  magnesium: 18,
  zinc: 0.8,
  vitaminA: 35,
  vitaminC: 6,
  vitaminD: 0.4,
  vitaminB12: 0.3,
  folate: 18,
};

function aiFood(
  overrides: Partial<MealEstimate["foods"][number]> = {},
): MealEstimate["foods"][number] {
  return {
    name: "Dragon fruit protein bar XYZ",
    estimatedAmount: 1,
    unit: "serving",
    ...AI_NUTRIENTS,
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

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  resetDescriptionAiProvider();
});

describe("description AI boundary", () => {
  it("sends description only and returns the 16-nutrient contract", async () => {
    const fetcher = jest.fn(async () =>
      response({ foods: [aiFood()] }),
    );
    const provider = createRenderDescriptionAiProvider({
      baseUrl: "https://proxy.example/",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(provider).not.toBeNull();

    const result = await provider!.estimate("dragon fruit protein bar XYZ");

    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));

    expect(url).toBe("https://proxy.example/estimate");
    expect(body).toEqual({
      description: "dragon fruit protein bar XYZ",
    });
    expect(Object.keys(body)).toEqual(["description"]);
    expect(JSON.stringify(body)).not.toMatch(
      /image|photo|camera|mime|base64|vision/i,
    );
    expect(result.foods[0]).toMatchObject({
      name: "Dragon fruit protein bar XYZ",
      calories: 321,
      vitaminD: 0.4,
    });
  });

  it("uses compatible Food DB nutrition over AI nutrition", () => {
    const result = applyFoodDbPrecedence(
      estimateWith([
        aiFood({
          name: "Cooked rice",
          estimatedAmount: 200,
          unit: "g",
          calories: 999,
          protein: 99,
        }),
      ]),
    );

    expect(result.foods[0]).toMatchObject({
      name: "Cooked rice",
      entryId: "cooked-rice",
      estimatedAmount: 200,
      unit: "g",
      calories: 260,
      protein: 5.4,
      nutritionSource: "food-db",
    });
    expect(result.totals.calories).toBe(260);
  });

  it("keeps an unknown AI food and its nutrition instead of fabricating locally", () => {
    const result = applyFoodDbPrecedence(estimateWith([aiFood()]));

    expect(result.foods[0]).toMatchObject({
      name: "Dragon fruit protein bar XYZ",
      calories: 321,
      protein: 22,
      vitaminA: 35,
      nutritionSource: "ai",
    });
    expect(result.foods[0]).not.toHaveProperty("entryId");
  });

  it("keeps multiple AI foods separate and sums their micronutrients", async () => {
    const provider: DescriptionAiProvider = {
      estimate: async () =>
        estimateWith([
          aiFood({
            name: "Dragon fruit protein bar XYZ",
            calories: 300,
            vitaminD: 0.3,
          }),
          aiFood({
            name: "Mystery granola clusters",
            unit: "cup",
            calories: 220,
            vitaminD: 0.1,
          }),
        ]),
    };

    const result = await resolveMealDescriptionWithProviderStaged(
      "a bar and a cup of mystery granola clusters",
      undefined,
      undefined,
      undefined,
      provider,
    );

    if (result.status !== "resolved") {
      throw new Error("expected AI estimate");
    }

    expect(result.estimate.foods).toHaveLength(2);
    expect(result.estimate.foods.map((food) => food.name)).toEqual([
      "Dragon fruit protein bar XYZ",
      "Mystery granola clusters",
    ]);
    expect(result.estimate.totals.calories).toBe(520);
    expect(result.estimate.totals.vitaminD).toBe(0.4);
  });

  it("preserves AI micronutrients in the MealEstimate", async () => {
    const provider: DescriptionAiProvider = {
      estimate: async () => estimateWith([aiFood()]),
    };

    const result = await resolveMealDescriptionWithProviderStaged(
      "dragon fruit protein bar XYZ",
      undefined,
      undefined,
      undefined,
      provider,
    );

    if (result.status !== "resolved") {
      throw new Error("expected AI estimate");
    }

    expect(result.estimate.foods[0]).toMatchObject({
      fiber: 4,
      sodium: 180,
      potassium: 240,
      calcium: 55,
      iron: 1.2,
      magnesium: 18,
      zinc: 0.8,
      vitaminA: 35,
      vitaminC: 6,
      vitaminD: 0.4,
      vitaminB12: 0.3,
      folate: 18,
    });
    expect(result.estimate.totals.fiber).toBe(4);
    expect(result.estimate.totals.folate).toBe(18);
  });

  it("classifies a proxy HTTP failure without exposing a local estimate", async () => {
    const provider = createRenderDescriptionAiProvider({
      baseUrl: "https://proxy.example",
      fetcher: (async () =>
        response({ error: "upstream unavailable" }, false, 503)) as unknown as typeof fetch,
    });

    await expect(provider!.estimate("mystery food")).rejects.toMatchObject({
      code: "http",
      statusCode: 503,
    });
  });

  it("returns a typed provider failure without a fake estimate", async () => {
    const provider: DescriptionAiProvider = {
      estimate: async () => {
        throw new Error("socket closed");
      },
    };

    const result = await resolveMealDescriptionWithProviderStaged(
      "dragon fruit protein bar XYZ",
      undefined,
      undefined,
      undefined,
      provider,
    );

    expect(result.status).toBe("failed");

    if (result.status !== "failed") {
      throw new Error("expected typed failure");
    }

    expect(result.error).toBeInstanceOf(DescriptionAiError);
    expect(result.error.code).toBe("network");
    expect(result).not.toHaveProperty("estimate");
  });

  it("retains the local Food DB/manual flow when no provider is configured", async () => {
    setDescriptionAiProvider(null);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => {
      throw new Error("network must not be used without a provider");
    }) as unknown as typeof fetch;

    try {
      const result = await resolveMealDescriptionWithProviderStaged(
        "10 eggs + 200g cooked rice + 150g curd",
      );

      if (result.status !== "resolved") {
        throw new Error("expected local resolution");
      }

      expect(result.estimate.foods).toHaveLength(3);
      expect(result.estimate.foods[0]).toMatchObject({
        entryId: "boiled-egg",
        nutritionSource: "food-db",
      });
      expect(result.estimate.totals.calories).toBe(1050);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
