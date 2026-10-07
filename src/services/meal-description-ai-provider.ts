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
export interface DescriptionAiProvider {
  estimate(description: string): Promise<MealEstimate>;
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

    return {
      name,
      estimatedAmount,
      unit,
      ...values,
      nutritionSource: "ai",
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
  const timeoutMs = options.timeoutMs ?? 60_000;
  const endpoint = descriptionProxyEndpoint(baseUrl);

  return {
    async estimate(description: string): Promise<MealEstimate> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          // Description is the sole request field. In particular, no
          // image/photo/MIME field is ever constructed or sent.
          body: JSON.stringify({ description }),
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
