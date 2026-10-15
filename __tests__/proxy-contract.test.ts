/**
 * The gymos-proxy `/estimate` contract, as the app enforces it.
 *
 * Three layers:
 *  1. A golden response the proxy must be able to produce (parses cleanly).
 *  2. The exact request the app sends, and every way a response is rejected.
 *  3. A LIVE suite that runs the app's real client against a real proxy.
 *     Skipped unless GYMOS_PROXY_URL is set:
 *       GYMOS_PROXY_URL=https://your-proxy.onrender.com npx jest proxy-contract
 *
 * The app's parser is the source of truth for "valid", so the live suite
 * cannot drift from what production code accepts.
 */
import {
  createRenderDescriptionAiProvider,
  descriptionProxyHealthEndpoint,
  DescriptionAiError,
  isProxyCold,
  markProxyActive,
  parseDescriptionAiEstimate,
  pingProxyHealth,
  resetProxyActiveForTest,
} from "@/services/meal-description-ai-provider";
import { NUTRIENT_KEYS } from "@/types/gymos";

/** One food exactly as the proxy must return it: name, a positive amount
 *  and unit, and ALL 16 nutrients as finite numbers >= 0, for the WHOLE
 *  stated amount (never per 100 g). */
export const GOLDEN_FOOD = {
  name: "Roti (phulka)",
  estimatedAmount: 2,
  unit: "piece",
  calories: 160,
  protein: 6,
  carbs: 32,
  fat: 1.6,
  fiber: 4,
  sodium: 4,
  potassium: 120,
  calcium: 20,
  iron: 1.6,
  magnesium: 40,
  zinc: 1,
  vitaminA: 0,
  vitaminC: 0,
  vitaminD: 0,
  vitaminB12: 0,
  folate: 24,
};

const GOLDEN_RESPONSE = { foods: [GOLDEN_FOOD] };

function fakeProxy(
  respond: (url: string, init: RequestInit) => Promise<Response> | Response,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });

    return respond(url, init);
  }) as unknown as typeof fetch;

  return { calls, fetcher };
}

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => "" }) as Response;

describe("golden /estimate response", () => {
  it("covers every nutrient the app requires", () => {
    for (const key of NUTRIENT_KEYS) {
      expect(typeof (GOLDEN_FOOD as Record<string, unknown>)[key]).toBe("number");
    }

    expect(NUTRIENT_KEYS).toHaveLength(16);
  });

  it("parses, and the app rebuilds totals itself", () => {
    const estimate = parseDescriptionAiEstimate({
      ...GOLDEN_RESPONSE,
      totals: { calories: 99999 }, // ignored: never trusted
    });

    expect(estimate.foods).toHaveLength(1);
    expect(estimate.foods[0]).toMatchObject({ name: "Roti (phulka)", unit: "piece", nutritionSource: "ai" });
    expect(estimate.totals.calories).toBe(160);
  });

  it("tolerates extra fields (forward compatible)", () => {
    const estimate = parseDescriptionAiEstimate({
      foods: [{ ...GOLDEN_FOOD, confidence: 0.4, notes: "x" }],
      contractVersion: 2,
    });

    expect(estimate.foods).toHaveLength(1);
  });

  it("parses Phase C contract fields correctly", () => {
    const phaseCFood = {
      ...GOLDEN_FOOD,
      category: "dish",
      confidence: 0.85,
      source: "model",
      assumption: "2 medium phulkas made without ghee",
      gramsOrMl: 70,
    };

    const estimate = parseDescriptionAiEstimate({
      foods: [phaseCFood],
      contractVersion: 2,
    });

    expect(estimate.foods[0]).toMatchObject({
      name: "Roti (phulka)",
      category: "dish",
      confidence: 0.85,
      source: "model",
      assumption: "2 medium phulkas made without ghee",
      gramsOrMl: 70,
      unresolved: false,
    });
  });

  it("enforces zero-calorie protection by marking 0 kcal food as unresolved", () => {
    const zeroCalFood = {
      ...GOLDEN_FOOD,
      name: "Bhatura",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    const estimate = parseDescriptionAiEstimate({
      foods: [zeroCalFood],
    });

    // Zero-calorie food must be marked unresolved so it is never saved silently
    expect(estimate.foods[0].unresolved).toBe(true);
  });

  it("allows 0 kcal for water without marking unresolved", () => {
    const waterFood = {
      ...GOLDEN_FOOD,
      name: "Water",
      unit: "glass",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    const estimate = parseDescriptionAiEstimate({
      foods: [waterFood],
    });

    expect(estimate.foods[0].unresolved).toBe(false);
  });
});

describe("what the app sends", () => {
  it("POSTs exactly { description } to /estimate with JSON headers", async () => {
    const { calls, fetcher } = fakeProxy(() => json(GOLDEN_RESPONSE));
    const provider = createRenderDescriptionAiProvider({ baseUrl: "https://p.test", fetcher });

    await provider?.estimate("2 rotis and dal");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://p.test/estimate");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ description: "2 rotis and dal" });
    expect(calls[0]?.init.headers).toEqual({
      accept: "application/json",
      "content-type": "application/json",
    });
  });

  it("sends no credentials: the key lives only in the proxy", async () => {
    const { calls, fetcher } = fakeProxy(() => json(GOLDEN_RESPONSE));

    await createRenderDescriptionAiProvider({ baseUrl: "https://p.test", fetcher })?.estimate("x");

    const headers = JSON.stringify(calls[0]?.init.headers).toLowerCase();

    expect(headers).not.toContain("authorization");
    expect(headers).not.toContain("api-key");
    expect(headers).not.toContain("x-goog");
  });

  it("accepts a base URL with a trailing slash or the /estimate suffix", async () => {
    for (const base of ["https://p.test/", "https://p.test/estimate", "https://p.test//"]) {
      const { calls, fetcher } = fakeProxy(() => json(GOLDEN_RESPONSE));

      await createRenderDescriptionAiProvider({ baseUrl: base, fetcher })?.estimate("x");
      expect(calls[0]?.url).toBe("https://p.test/estimate");
    }
  });

  it("is disabled (null provider) when no URL is configured", () => {
    expect(createRenderDescriptionAiProvider({ baseUrl: "   " })).toBeNull();
  });

  it("deduplicates concurrent in-flight requests for the exact same text", async () => {
    let callCount = 0;
    const { fetcher } = fakeProxy(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return json(GOLDEN_RESPONSE);
    });

    const provider = createRenderDescriptionAiProvider({ baseUrl: "https://p.test", fetcher });

    // Fire 2 simultaneous requests for identical text
    const [res1, res2] = await Promise.all([
      provider?.estimate("2 rotis and dal"),
      provider?.estimate("2 rotis and dal"),
    ]);

    expect(callCount).toBe(1);
    expect(res1?.foods[0]?.name).toBe("Roti (phulka)");
    expect(res2?.foods[0]?.name).toBe("Roti (phulka)");
  });

  it("sends fresh: true when requested, bypassing cache", async () => {
    const { calls, fetcher } = fakeProxy(() => json(GOLDEN_RESPONSE));
    const provider = createRenderDescriptionAiProvider({ baseUrl: "https://p.test", fetcher });

    await provider?.estimate("2 rotis", { fresh: true });

    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      description: "2 rotis",
      fresh: true,
    });
  });
});

describe("how the app rejects a response", () => {
  const reject = (payload: unknown) => {
    try {
      parseDescriptionAiEstimate(payload);
    } catch (error) {
      expect(error).toBeInstanceOf(DescriptionAiError);

      return (error as DescriptionAiError).code;
    }

    return "accepted";
  };

  it("rejects non-objects, missing/empty foods", () => {
    expect(reject(null)).toBe("invalid-response");
    expect(reject({})).toBe("invalid-response");
    expect(reject({ foods: "x" })).toBe("invalid-response");
    expect(reject({ foods: [] })).toBe("invalid-response");
  });

  it("rejects a food with no name, bad amount, or no unit", () => {
    expect(reject({ foods: [{ ...GOLDEN_FOOD, name: "  " }] })).toBe("invalid-response");
    expect(reject({ foods: [{ ...GOLDEN_FOOD, estimatedAmount: 0 }] })).toBe("invalid-response");
    expect(reject({ foods: [{ ...GOLDEN_FOOD, estimatedAmount: "2" }] })).toBe("invalid-response");
    expect(reject({ foods: [{ ...GOLDEN_FOOD, unit: "" }] })).toBe("invalid-response");
  });

  it("rejects the WHOLE response if any one nutrient is missing, negative or non-numeric", () => {
    for (const key of NUTRIENT_KEYS) {
      const missing: Record<string, unknown> = { ...GOLDEN_FOOD };

      delete missing[key];
      expect(reject({ foods: [missing] })).toBe("invalid-response");
      expect(reject({ foods: [{ ...GOLDEN_FOOD, [key]: -1 }] })).toBe("invalid-response");
      expect(reject({ foods: [{ ...GOLDEN_FOOD, [key]: "5" }] })).toBe("invalid-response");
      expect(reject({ foods: [{ ...GOLDEN_FOOD, [key]: null }] })).toBe("invalid-response");
    }
  });

  it("one bad food among good ones still rejects everything", () => {
    expect(reject({ foods: [GOLDEN_FOOD, { ...GOLDEN_FOOD, protein: undefined }] })).toBe("invalid-response");
  });

  it("maps HTTP failures and network failures to typed errors", async () => {
    const http = createRenderDescriptionAiProvider({
      baseUrl: "https://p.test",
      fetcher: fakeProxy(() => json({ error: "boom" }, 502)).fetcher,
    });
    const net = createRenderDescriptionAiProvider({
      baseUrl: "https://p.test",
      fetcher: (async () => {
        throw new TypeError("Network request failed");
      }) as unknown as typeof fetch,
    });
    const notJson = createRenderDescriptionAiProvider({
      baseUrl: "https://p.test",
      fetcher: (async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad"); }, text: async () => "" }) as unknown as Response) as unknown as typeof fetch,
    });

    await expect(http?.estimate("x")).rejects.toMatchObject({ code: "http", statusCode: 502 });
    await expect(net?.estimate("x")).rejects.toMatchObject({ code: "network" });
    await expect(notJson?.estimate("x")).rejects.toMatchObject({ code: "invalid-response" });
  });
});

describe("proxy health ping and cold-start handling (Step 4)", () => {
  beforeEach(() => {
    resetProxyActiveForTest();
  });

  it("resolves /health endpoint correctly from base url or /estimate endpoint", () => {
    expect(descriptionProxyHealthEndpoint("https://gymos-proxy.onrender.com")).toBe(
      "https://gymos-proxy.onrender.com/health",
    );
    expect(
      descriptionProxyHealthEndpoint("https://gymos-proxy.onrender.com/estimate"),
    ).toBe("https://gymos-proxy.onrender.com/health");
    expect(descriptionProxyHealthEndpoint("https://gymos-proxy.onrender.com/")).toBe(
      "https://gymos-proxy.onrender.com/health",
    );
  });

  it("tracks cold vs warm proxy state and warms up on health ping", async () => {
    expect(isProxyCold()).toBe(true);

    let pingUrl = "";
    const fetcher = (async (url: string) => {
      pingUrl = url;
      return json({ status: "ok", version: 2, contractVersion: 2 });
    }) as unknown as typeof fetch;

    pingProxyHealth({ baseUrl: "https://p.test", fetcher });
    await Promise.resolve();
    await Promise.resolve();

    expect(pingUrl).toBe("https://p.test/health");
    expect(isProxyCold()).toBe(false);
  });

  it("warms up after a successful estimate", async () => {
    expect(isProxyCold()).toBe(true);

    const { fetcher } = fakeProxy(() => json(GOLDEN_RESPONSE));
    const provider = createRenderDescriptionAiProvider({
      baseUrl: "https://p.test",
      fetcher,
    });
    await provider?.estimate("roti");

    expect(isProxyCold()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* LIVE: real client against the real proxy. Opt-in.                   */
/* ------------------------------------------------------------------ */

const LIVE_URL = process.env.GYMOS_PROXY_URL;
const live = LIVE_URL ? describe : describe.skip;
// Cold starts on free hosting can take a while; the app allows 60 s.
const LIVE_TIMEOUT_MS = 90_000;

live("LIVE gymos-proxy /estimate (opt-in via GYMOS_PROXY_URL)", () => {
  const provider = () =>
    createRenderDescriptionAiProvider({ baseUrl: LIVE_URL ?? "", timeoutMs: LIVE_TIMEOUT_MS });

  for (const description of [
    "2 rotis and dal",
    "a plate of chicken biryani with raita",
    "paneer bhurji with 1 paratha",
  ]) {
    it(
      `returns a response the app accepts for "${description}"`,
      async () => {
        const estimate = await provider()?.estimate(description);

        expect(estimate?.foods.length).toBeGreaterThan(0);

        for (const food of estimate?.foods ?? []) {
          expect(food.estimatedAmount).toBeGreaterThan(0);
          // Whole-amount nutrition, not per 100 g: a plausible single food.
          expect(food.calories).toBeLessThan(3500);
        }
      },
      LIVE_TIMEOUT_MS,
    );
  }
});
