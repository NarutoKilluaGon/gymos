/**
 * The Render proxy transport for description-based meal estimation.
 *
 * This is the only file in the split that knows an HTTP request exists.
 * Everything else in the estimator works with `MealEstimate` and
 * `DescriptionAiProvider` — plain data and a one-method interface — so
 * swapping the transport later never touches parsing, resolution, or
 * review code.
 */

import type { EstimatedFood } from "@/types/gymos";
import type { MacroTotals } from "@/storage/repositories/meals";
import { NUTRIENT_KEYS } from "@/types/gymos";
import { computeMealTotals } from "@/services/meal-nutrition-math";

/**
 * Local food estimate: every resolved food plus editable totals.
 * Totals are an estimate of the sum of `foods` (kept for quick review);
 * `mealInputFromEstimate` flattens to the save path (MealInput).
 */
export type MealEstimate = {
  foods: EstimatedFood[];
  totals: MacroTotals;
};

/**
 * Provider-agnostic description intelligence boundary. The input is
 * deliberately a single description string: this V1 path has no image,
 * photo, camera, MIME, or base64 input.
 */
export type DescriptionAiEstimateOptions = {
  fresh?: boolean;
};

export interface DescriptionAiProvider {
  estimate(
    description: string,
    options?: DescriptionAiEstimateOptions,
  ): Promise<MealEstimate>;
}

export type DescriptionAiErrorCode =
  | "network"
  | "http"
  | "invalid-response";

/** Typed failure suitable for a future offline-queue consumer. */
export class DescriptionAiError extends Error {
  readonly code: DescriptionAiErrorCode;
  readonly statusCode?: number;
  readonly causeValue?: unknown;
  /** UI-safe copy; never exposes upstream/provider implementation details. */
  readonly userMessage = "AI nutrition unavailable. Try again.";

  constructor(
    code: DescriptionAiErrorCode,
    message: string,
    statusCode?: number,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = "DescriptionAiError";
    this.code = code;
    this.statusCode = statusCode;
    this.causeValue = causeValue;
  }
}

export type RenderDescriptionAiProviderOptions = {
  /** Public proxy base URL. Defaults to EXPO_PUBLIC_VISION_API_URL. */
  baseUrl?: string;
  /** Injectable for tests; production uses the platform fetch. */
  fetcher?: typeof fetch;
  /** Real request timeout; not a loading delay. */
  timeoutMs?: number;
};

let descriptionAiProviderOverride:
  | DescriptionAiProvider
  | null
  | undefined;

/** Read the public Render proxy URL. Expo statically inlines this property. */
function configuredDescriptionProxyUrl(): string {
  const value = process.env.EXPO_PUBLIC_VISION_API_URL;
  return typeof value === "string" ? value.trim() : "";
}

function descriptionProxyEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");

  return normalized.endsWith("/estimate")
    ? normalized
    : `${normalized}/estimate`;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
let lastProxyActiveTimestamp: number | null = null;

export function isProxyCold(): boolean {
  if (lastProxyActiveTimestamp === null) return true;
  return Date.now() - lastProxyActiveTimestamp > IDLE_TIMEOUT_MS;
}

export function markProxyActive(): void {
  lastProxyActiveTimestamp = Date.now();
}

export function resetProxyActiveForTest(): void {
  lastProxyActiveTimestamp = null;
}

export function descriptionProxyHealthEndpoint(baseUrl?: string): string {
  const base = (baseUrl ?? configuredDescriptionProxyUrl()).trim().replace(/\/+$/, "");
  if (!base) return "";
  const root = base.endsWith("/estimate") ? base.slice(0, -"/estimate".length) : base;
  return `${root}/health`;
}

export function pingProxyHealth(options?: {
  baseUrl?: string;
  fetcher?: typeof fetch;
}): void {
  const endpoint = descriptionProxyHealthEndpoint(options?.baseUrl);
  if (!endpoint) return;
  const f = options?.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  f(endpoint, { method: "GET", signal: controller.signal })
    .then((res) => {
      if (res.ok) markProxyActive();
    })
    .catch(() => {
      // Best-effort health ping; ignore network failures
    })
    .finally(() => {
      clearTimeout(timer);
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidDescriptionAiResponse(
  message: string,
): DescriptionAiError {
  return new DescriptionAiError("invalid-response", message);
}

/**
 * Validate the proxy's description-only response and rebuild totals from
 * the validated foods. Provider totals are never trusted as authoritative.
 * Every food must contain the complete 16-nutrient contract.
 *
 * Exported (it wasn't before the split) so the resolution flow can run the
 * exact same validation against a custom/test provider's response, not
 * just the Render client's own.
 */
export function parseDescriptionAiEstimate(
  payload: unknown,
): MealEstimate {
  if (!isRecord(payload) || !Array.isArray(payload.foods)) {
    throw invalidDescriptionAiResponse(
      "Description AI response did not contain foods",
    );
  }

  if (payload.foods.length === 0) {
    throw invalidDescriptionAiResponse(
      "Description AI response contained no foods",
    );
  }

  const foods: EstimatedFood[] = payload.foods.map((raw) => {
    if (!isRecord(raw)) {
      throw invalidDescriptionAiResponse(
        "Description AI returned an invalid food",
      );
    }

    const name =
      typeof raw.name === "string" ? raw.name.trim() : "";

    if (!name) {
      throw invalidDescriptionAiResponse(
        "Description AI returned a food without a name",
      );
    }

    const estimatedAmount = raw.estimatedAmount;
    if (
      typeof estimatedAmount !== "number" ||
      !Number.isFinite(estimatedAmount) ||
      estimatedAmount <= 0
    ) {
      throw invalidDescriptionAiResponse(
        "Description AI returned an invalid food amount",
      );
    }

    const unit =
      typeof raw.unit === "string" ? raw.unit.trim() : "";

    if (!unit) {
      throw invalidDescriptionAiResponse(
        "Description AI returned a food without a unit",
      );
    }

    const values: Record<string, number> = {};

    for (const key of NUTRIENT_KEYS) {
      const value = raw[key];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        throw invalidDescriptionAiResponse(
          `Description AI returned an invalid ${key} value`,
        );
      }

      values[key] = value;
    }

    // Phase C Contract fields (tolerating legacy responses)
    const validCategories = new Set(["dish", "drink", "ingredient", "spice", "packaged"]);
    const rawCat = typeof raw.category === "string" ? raw.category.toLowerCase().trim() : "";
    const category = validCategories.has(rawCat)
      ? (rawCat as "dish" | "drink" | "ingredient" | "spice" | "packaged")
      : undefined;

    const confidence =
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.75;

    const source = raw.source === "web" ? "web" : "model";

    const assumption =
      typeof raw.assumption === "string" && raw.assumption.trim()
        ? raw.assumption.trim()
        : undefined;

    const gramsOrMl =
      typeof raw.gramsOrMl === "number" && Number.isFinite(raw.gramsOrMl) && raw.gramsOrMl > 0
        ? raw.gramsOrMl
        : undefined;

    // Zero-calorie protection: Never save 0 kcal food silently!
    const isWater = name.toLowerCase().includes("water") || name.toLowerCase().includes("paani");
    const isZeroKcal = (values.calories === 0 && !isWater);
    const unresolved = isZeroKcal || raw.unresolved === true;

    return {
      name,
      estimatedAmount,
      unit,
      ...values,
      nutritionSource: "ai",
      category,
      confidence,
      source,
      assumption,
      gramsOrMl,
      unresolved,
    } as EstimatedFood;
  });

  return {
    foods,
    totals: computeMealTotals(foods),
  };
}

/**
 * Create the Render proxy client. No API key or provider-specific setting
 * is accepted here: the mobile app sends only `{ description }` to the
 * public `/estimate` endpoint. Returns null when no public URL is
 * configured, allowing the existing local resolver to remain active.
 */
export function createRenderDescriptionAiProvider(
  options: RenderDescriptionAiProviderOptions = {},
): DescriptionAiProvider | null {
  const baseUrl = (
    options.baseUrl ?? configuredDescriptionProxyUrl()
  ).trim();

  if (!baseUrl) {
    return null;
  }

  const fetcher = options.fetcher ?? fetch;
  const endpoint = descriptionProxyEndpoint(baseUrl);

  const inFlightRequests = new Map<string, Promise<MealEstimate>>();

  return {
    async estimate(
      description: string,
      estimateOptions?: DescriptionAiEstimateOptions,
    ): Promise<MealEstimate> {
      const normalizedKey = description.trim().toLowerCase();

      // Deduplicate: do not re-send while a request for the same text is in flight
      if (!estimateOptions?.fresh && inFlightRequests.has(normalizedKey)) {
        return inFlightRequests.get(normalizedKey)!;
      }

      const execute = async () => {
        const effectiveTimeout =
          options.timeoutMs ?? (isProxyCold() ? 45_000 : 25_000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), effectiveTimeout);

        try {
          const bodyPayload: { description: string; fresh?: boolean } = {
            description,
          };
          if (estimateOptions?.fresh) {
            bodyPayload.fresh = true;
          }

          const response = await fetcher(endpoint, {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });

          if (!response.ok) {
            // Consume the response for connection hygiene, but do not expose
            // upstream/provider text to the UI.
            await response.text().catch(() => "");
            throw new DescriptionAiError(
              "http",
              `Description AI request failed (${response.status})`,
              response.status,
            );
          }

          markProxyActive();

          let payload: unknown;

          try {
            payload = await response.json();
          } catch {
            throw invalidDescriptionAiResponse(
              "Description AI returned invalid JSON",
            );
          }

          return parseDescriptionAiEstimate(payload);
        } catch (error) {
          if (error instanceof DescriptionAiError) {
            throw error;
          }

          if (controller.signal.aborted) {
            throw new DescriptionAiError(
              "network",
              "Description AI request timed out",
              undefined,
              error,
            );
          }

          throw new DescriptionAiError(
            "network",
            "Description AI request failed",
            undefined,
            error,
          );
        } finally {
          clearTimeout(timer);
        }
      };

      const promise = execute();
      if (!estimateOptions?.fresh) {
        inFlightRequests.set(normalizedKey, promise);
      }

      try {
        return await promise;
      } finally {
        if (!estimateOptions?.fresh) {
          inFlightRequests.delete(normalizedKey);
        }
      }
    },
  };
}

/** Override the provider for tests or an app composition root. */
export function setDescriptionAiProvider(
  provider: DescriptionAiProvider | null,
): void {
  descriptionAiProviderOverride = provider;
}

/** Clear an explicit override and return to the public-env default. */
export function resetDescriptionAiProvider(): void {
  descriptionAiProviderOverride = undefined;
}

/** Get the explicitly configured provider or the env-backed Render client. */
export function getDescriptionAiProvider(): DescriptionAiProvider | null {
  if (descriptionAiProviderOverride !== undefined) {
    return descriptionAiProviderOverride;
  }

  return createRenderDescriptionAiProvider();
}
