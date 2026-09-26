/**
 * Local Food DB meal estimation with an optional description AI provider.
 *
 * A typed description is split into food segments
 * (`splitDescriptionSegments` + `parseLeadingQuantity`), each segment is
 * matched against the offline food database (`resolveSegmentLocally`),
 * then the user's own saved foods — and anything without a confident
 * match is flagged `unresolved` for manual entry. When a description AI
 * provider is configured, the complete description is sent first; its
 * returned foods are then overlaid with reliable local Food DB nutrition.
 * Scaling, totals, editing, persistence, review, and saved foods are all
 * local. Photo/image input is not part of this path.
 *
 * V1: curated list of common meals with estimated macros (QUICK_MEALS).
 * The user taps one → it pre-fills the MealSheet (detected foods + totals)
 * → they can edit before saving. No manual macro entry needed for the most
 * common foods.
 */

import type {
  EstimatedFood,
  MealInput,
} from "@/components/quick-add/meal-sheet";
import {
  getFoodEntry,
  isSameUnit,
  matchFoodEntry,
  normalizeFoodName,
  scalePortionMacros,
} from "@/services/food-db";
import type { MacroTotals } from "@/storage/repositories/meals";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import type { Meal, MealFood } from "@/types/gymos";
import {
  MACRO_KEYS,
  MICRONUTRIENT_KEYS,
  NUTRIENT_KEYS,
  pickMicronutrients,
  type Micronutrients,
  type NutritionSource,
} from "@/types/gymos";
import { createId } from "@/utils/id";

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
 */
function parseDescriptionAiEstimate(payload: unknown): MealEstimate {
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

/** Wrap one meal as a single-food estimate (quick-pick catalog). */
function singleFoodEstimate(meal: MealInput): MealEstimate {
  const food: EstimatedFood = {
    name: meal.name,
    estimatedAmount: 1,
    unit: "serving",
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    ...pickMicronutrients(meal),
  };

  return {
    foods: [food],
    totals: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      ...pickMicronutrients(food),
    },
  };
}

/**
 * Flatten an estimate into the MealSheet's manual-entry shape:
 * meal name = joined food names, meal macros = totals (both editable
 * in the sheet before saving).
 */
export function mealInputFromEstimate(
  estimate: MealEstimate,
): MealInput {
  return {
    name: estimate.foods
      .map((food) => food.name)
      .join(", "),
    calories: estimate.totals.calories,
    protein: estimate.totals.protein,
    carbs: estimate.totals.carbs,
    fat: estimate.totals.fat,
    ...pickMicronutrients(estimate.totals),
    ...(estimate.foods.length > 0
      ? {
          foods: estimate.foods.map(estimatedFoodToMealFood),
        }
      : {}),
  };
}

/**
 * Build the MealInput emitted by the review sheet. Derived food totals
 * are authoritative for keys represented by the current rows, while the
 * original meal-level micronutrients remain a fallback for sparse legacy
 * rows. This keeps a re-save from turning an unknown row into a newly
 * invented zero when the persisted meal already carried a value.
 */
export function mealInputForSave(input: {
  name: string;
  displayedTotals: Pick<
    MealInput,
    "calories" | "protein" | "carbs" | "fat"
  >;
  derivedTotals?: MacroTotals | null;
  foods?: MealFood[];
  fallbackMicronutrients?: Micronutrients;
}): MealInput {
  const foods = input.foods ?? [];
  const derivedMicronutrients = input.derivedTotals
    ? pickMicronutrients(input.derivedTotals)
    : {};
  const fallbackMicronutrients = pickMicronutrients(
    input.fallbackMicronutrients ?? {},
  );

  // Resolve represented-row precedence once here as well as at the
  // persistence boundary. This keeps the helper correct when used by a
  // caller that does not immediately invoke toCanonicalMealNutrition().
  const canonical = toCanonicalMealNutrition({
    ...input.displayedTotals,
    ...derivedMicronutrients,
    ...fallbackMicronutrients,
    foods,
  });

  return {
    name: input.name.trim(),
    ...input.displayedTotals,
    ...pickMicronutrients(canonical),
    ...(foods.length > 0 ? { foods } : {}),
  };
}

/** Repeat a stored meal without dropping its flat micronutrients. */
export function mealInputFromRecentMeal(meal: Meal): MealInput {
  return {
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    ...pickMicronutrients(meal),
    ...(meal.foods && meal.foods.length > 0
      ? { foods: meal.foods }
      : {}),
  };
}

/**
 * Fold one stored food (plus its LEGACY additionals, if any) into a flat
 * set of nutrients. S6A removed the additionals concept from the meal
 * editor: reopening an old meal folds their nutrition into the parent
 * food, so every stored nutrient survives while the nested list does not
 * reappear. Key presence mirrors the inputs — micros only appear when
 * defined somewhere, keeping sparse legacy records sparse.
 */
function foldFoodNutrition(food: MealFood): MacroTotals {
  const items = [food, ...(food.additionals ?? [])];
  const out: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const sum = (key: (typeof NUTRIENT_KEYS)[number]) =>
    round2(
      items.reduce(
        (total, item) => total + (item[key] ?? 0),
        0,
      ),
    );

  for (const key of MACRO_KEYS) {
    out[key] = sum(key);
  }

  for (const key of MICRONUTRIENT_KEYS) {
    const defined = items.some(
      (item) => typeof item[key] === "number",
    );

    if (defined) {
      out[key] = sum(key);
    }
  }

  return out;
}

/**
 * Reopen a saved meal in the review/edit flow: convert the persisted
 * breakdown back into an estimate. Meals saved without a breakdown
 * (totals-only) yield zero food rows — their totals still seed the sheet.
 * Legacy additionals are folded flat (see foldFoodNutrition); the
 * catalog id rides along so amount edits can rescale after a reload.
 */
export function mealToEstimate(meal: Meal): MealEstimate {
  const foods: EstimatedFood[] = (meal.foods ?? []).map((food) => ({
    name: food.name,
    estimatedAmount: food.amount ?? 0,
    unit: food.unit ?? "",
    ...foldFoodNutrition(food),
    ...(food.entryId ? { entryId: food.entryId } : {}),
  }));

  return {
    foods,
    totals: {
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      ...pickMicronutrients(meal),
    },
  };
}

/**
 * Rebuild a reusable saved meal (S4) as a reviewable estimate from its
 * STORED values only — no food DB lookup, network, or recalculation.
 * Each food is a fresh object, so editing the logged copy can never
 * mutate the saved template.
 */
export function savedFoodToEstimate(saved: SavedFood): MealEstimate {
  return mealToEstimate({
    id: saved.id,
    name: saved.name,
    timestamp: saved.createdAt,
    calories: saved.calories,
    protein: saved.protein,
    carbs: saved.carbs,
    fat: saved.fat,
    ...(saved.foods ? { foods: saved.foods } : {}),
    ...pickMicronutrients(saved),
  });
}

/**
 * Derive compact recent foods from logged meals for fast repeat
 * logging: individual breakdown foods across the given meals, latest
 * first, deduped by normalized name (the first hit wins, so the most
 * recent logging is the reference). Malformed meals/foods are skipped,
 * never thrown. Pure — the screen memoizes this over today's meals, so
 * no new storage exists.
 */
export function recentFoodsFromMeals(
  meals?: Meal[] | null,
  limit = 6,
): MealFood[] {
  const list = Array.isArray(meals) ? meals : [];
  const ordered = [...list].sort((a, b) => {
    const timeA =
      a && typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : Number.NaN;
    const timeB =
      b && typeof b.timestamp === "string"
        ? new Date(b.timestamp).getTime()
        : Number.NaN;
    const safeA = Number.isFinite(timeA) ? timeA : Number.NEGATIVE_INFINITY;
    const safeB = Number.isFinite(timeB) ? timeB : Number.NEGATIVE_INFINITY;

    return safeB - safeA;
  });

  const seen = new Set<string>();
  const out: MealFood[] = [];

  for (const meal of ordered) {
    const foods =
      meal && Array.isArray(meal.foods) ? meal.foods : [];

    for (const food of foods) {
      const key =
        food && typeof food.name === "string"
          ? food.name.trim().toLowerCase()
          : "";

      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      out.push(food);

      if (out.length >= limit) {
        return out;
      }
    }
  }

  return out;
}

/**
 * Secondary card line for a meal's foods, or null when it merely repeats
 * the title (every food name already appears in it). Keeps diary cards
 * compact without losing information.
 */
export function mealFoodsLine(
  name: string,
  foods?: MealFood[],
): string | null {
  // Defensive: persisted records predate validation (raw import/restore
  // carries any JSON shape), so coerce instead of calling methods on
  // possibly-malformed values. Valid records behave exactly as before.
  const names = (Array.isArray(foods) ? foods : [])
    .map((food) => String(food?.name ?? "").trim())
    .filter((foodName) => foodName.length > 0);

  if (names.length === 0) {
    return null;
  }

  const title = String(name ?? "")
    .trim()
    .toLowerCase();
  const addsInfo = names.some(
    (foodName) => !title.includes(foodName.toLowerCase()),
  );

  return addsInfo ? names.join(" + ") : null;
}

/**
 * Sum meal-level totals from a per-food breakdown. Pure and shared: the
 * review sheet derives its displayed totals from this one implementation
 * on every edit (S6A — there is no manual recalc), and tests assert
 * against it too. Each food's LEGACY additionals still count, so stored
 * records never lose nutrition even though nothing creates them anymore.
 */
export function computeMealTotals(
  foods: MealFood[],
): MacroTotals {
  const totals: MacroTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  for (const food of foods) {
    // Each food plus its additionals, across the canonical nutrient list
    // (macros + micros; absent reads as untracked zero).
    const items = [food, ...(food.additionals ?? [])];

    for (const item of items) {
      for (const key of NUTRIENT_KEYS) {
        totals[key] = (totals[key] ?? 0) + (item[key] ?? 0);
      }
    }
  }

  const round2 = (value: number) =>
    Math.round(value * 100) / 100;

  for (const key of NUTRIENT_KEYS) {
    totals[key] = round2(totals[key] ?? 0);
  }

  return totals;
}

export type CanonicalMealNutritionInput = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
} & Micronutrients & {
  /** Optional per-food breakdown. When present, macros come from it. */
  foods?: MealFood[];
};

function finiteNutritionNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

/**
 * Convert every meal entry point to the one persistence nutrition shape.
 * A supplied food breakdown is authoritative for macros and for any
 * micronutrient represented by at least one food. If a legacy breakdown
 * has no micronutrient values, a flat meal-level value is retained rather
 * than silently overwritten with zero.
 */
export function toCanonicalMealNutrition(
  input: CanonicalMealNutritionInput,
): MacroTotals {
  const flat: MacroTotals = {
    calories: finiteNutritionNumber(input.calories),
    protein: finiteNutritionNumber(input.protein),
    carbs: finiteNutritionNumber(input.carbs),
    fat: finiteNutritionNumber(input.fat),
    ...pickMicronutrients(input),
  };
  const foods = Array.isArray(input.foods)
    ? input.foods
    : [];

  if (foods.length === 0) {
    return flat;
  }

  const canonical = computeMealTotals(foods);

  for (const key of MICRONUTRIENT_KEYS) {
    const representedInFoods = foods.some((food) => {
      const items = [food, ...(food.additionals ?? [])];
      return items.some(
        (item) =>
          typeof item[key] === "number" &&
          Number.isFinite(item[key]),
      );
    });

    if (!representedInFoods) {
      const value = input[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        canonical[key] = value;
      }
    }
  }

  return canonical;
}

/** True when a reusable record contains at least one nutrition value. */
export function hasCanonicalNutrition(
  input: CanonicalMealNutritionInput,
): boolean {
  const nutrition = toCanonicalMealNutrition(input);
  return NUTRIENT_KEYS.some(
    (key) => (nutrition[key] ?? 0) > 0,
  );
}

/** Reuse requires both completed rows and a non-empty nutrition snapshot. */
export function canSaveReusableNutrition(
  input: CanonicalMealNutritionInput,
  hasUnresolvedFood = false,
): boolean {
  return !hasUnresolvedFood && hasCanonicalNutrition(input);
}

/** Curated common meals with estimated macros, searchable by name. */
export const QUICK_MEALS: MealInput[] = [
  { name: "Chicken breast (150g)", calories: 250, protein: 46, carbs: 0, fat: 5 },
  { name: "Grilled salmon (150g)", calories: 280, protein: 31, carbs: 0, fat: 17 },
  { name: "Ground beef (150g)", calories: 330, protein: 27, carbs: 0, fat: 24 },
  { name: "Eggs (2 scrambled)", calories: 180, protein: 12, carbs: 1, fat: 14 },
  { name: "Oatmeal (dry 40g)", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { name: "Rice (cooked 150g)", calories: 206, protein: 4, carbs: 45, fat: 0 },
  { name: "Sweet potato (150g)", calories: 129, protein: 2, carbs: 30, fat: 0 },
  { name: "Protein shake", calories: 160, protein: 27, carbs: 5, fat: 3 },
  { name: "Greek yogurt (200g)", calories: 140, protein: 20, carbs: 7, fat: 3 },
  { name: "Mixed salad bowl", calories: 220, protein: 10, carbs: 18, fat: 12 },
  { name: "Turkey sandwich", calories: 320, protein: 24, carbs: 35, fat: 10 },
  { name: "Peanut butter on toast", calories: 350, protein: 12, carbs: 30, fat: 18 },
  { name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Chicken burrito bowl", calories: 520, protein: 40, carbs: 55, fat: 16 },
  { name: "Pasta with tomato sauce", calories: 380, protein: 12, carbs: 65, fat: 8 },
];

export function searchQuickMeals(query: string): MealEstimate[] {
  const q = query.trim().toLowerCase();

  const matches = q
    ? QUICK_MEALS.filter((meal) =>
        meal.name.toLowerCase().includes(q),
      )
    : QUICK_MEALS;

  return matches.map(singleFoodEstimate);
}

/**
 * Split a typed description into candidate food segments on punctuation
 * (never inside decimals like "1.5") and food-list conjunctions
 * ("and"/"with"/"plus" as whole words — "coriander" stays intact).
 * This is the description parser: every segment becomes one review row.
 */
export function splitDescriptionSegments(
  description: string,
): string[] {
  return description
    .split(/[;,+]+|\.\s+|\s+(?:and|with|plus)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

// ---------- Local description resolution (offline Nutrition V1) ----------

/**
 * Fixed, explicit processing stages for description resolution. The UI
 * maps each stage to determinate progress only after the stage's work
 * actually completes — never arbitrary percentages.
 */
export const RESOLUTION_STAGES = [
  "Reading your meal",
  "Finding nutrition",
  "Calculating totals",
] as const;

/**
 * Derive a progress percentage from completed vs total work units.
 * Total ≤ 0 means "no measurable work" → 0 (never NaN); over-completion
 * clamps to 100.
 */
export function progressPercent(
  current: number,
  total: number,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

/** One progress update from the staged resolver: cumulative completed
 *  work units over total units, plus the active stage's label and an
 *  honest item detail string (e.g. "3 of 5"). Percentage is always
 *  `progressPercent(current, total)` — currents increase as work
 *  completes; totals reflect the final known row count. */
export type ResolutionProgress = {
  stageIndex: number;
  label: (typeof RESOLUTION_STAGES)[number];
  detail: string;
  current: number;
  total: number;
};

// ---------- Review rows + "+ Add food" resolution (S6A) ----------

/**
 * Editable review row for one detected/resolved food. Every displayed
 * field is text; micros ride along opaquely (no micro inputs exist in
 * the primary row UI). `entryId` links catalog-sourced rows back to the
 * offline food DB so later amount/unit edits can rescale nutrition —
 * absent for manually-resolved foods, which carry no catalog portion to
 * scale from. `unresolved` marks a row whose nutrition still needs manual
 * entry (never silently fabricated). A meal simply contains rows: there
 * is no additionals concept in this shape (legacy ones are folded flat
 * in `mealToEstimate`).
 */
export type FoodRow = {
  key: string;
  name: string;
  amount: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Opaque micro values carried through review. */
  micros: Micronutrients;
  /** Food DB entry id, when the nutrition came from the catalog. */
  entryId?: string;
  /** True when no confident catalog match existed: the row shows
   *  "Nutrition needed" and the user types macros manually before
   *  logging. Never persisted — the typed values are the record. */
  unresolved?: boolean;
  /** Stable scaling reference for non-catalog rows: the portion amount
   *  the row's nutrition currently describes. Quantity edits rescale all
   *  16 nutrients from `baseNutrition` — never from already-scaled
   *  values. Re-derivable after reload (never persisted). */
  baseAmount?: number;
  /** The 16-nutrient snapshot `baseAmount` describes. */
  baseNutrition?: MacroTotals;
  /** Transient provenance for review; not written to persisted MealFood. */
  nutritionSource?: NutritionSource;
};

/** Row numbers feed persistence/scaling only; blank/invalid count as 0. */
function parseRowNumber(value: string): number {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Optional number for persisted breakdown fields; blank/invalid → omit. */
function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Seed an editable review row from a resolved food. Unresolved foods
 *  seed with blank nutrition and the flag that renders "Nutrition
 *  needed" until the user types macros manually. Non-catalog rows
 *  (manually entered or reopened stored values) seed a stable scaling
 *  base from their own values so later quantity edits rescale locally —
 *  re-derivable after reload, never persisted. */
export function toFoodRow(food: EstimatedFood): FoodRow {
  const row: FoodRow = {
    key: createId(),
    name: food.name,
    amount: String(food.estimatedAmount),
    unit: food.unit,
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    micros: pickMicronutrients(food),
    ...(food.entryId ? { entryId: food.entryId } : {}),
    ...(food.unresolved ? { unresolved: true } : {}),
    ...(food.nutritionSource
      ? { nutritionSource: food.nutritionSource }
      : {}),
  };

  return establishRowBase(row);
}

/**
 * Establish (or refresh) a row's stable scaling base from its current
 * text fields: the portion amount plus the full 16-nutrient snapshot it
 * describes. Catalog-linked rows are left alone — they always scale
 * from the DB portion instead. Without a positive amount there is
 * nothing to anchor to, so the row is returned unchanged: typed values
 * simply stay until a usable amount exists. Pure.
 */
export function establishRowBase(row: FoodRow): FoodRow {
  if (row.entryId) {
    return row;
  }

  const parsed = Number(row.amount.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return row;
  }

  return {
    ...row,
    baseAmount: parsed,
    baseNutrition: snapshotRowNutrition(row),
  };
}

/** The row's current 16 nutrients as numbers (blank/invalid → 0, the
 *  same rule persistence uses). */
function snapshotRowNutrition(row: FoodRow): MacroTotals {
  const num = (value: string): number => {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    calories: num(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    ...row.micros,
  };
}

/** Convert an already-resolved estimate row to the persisted shape. */
export function estimatedFoodToMealFood(
  food: EstimatedFood,
): MealFood {
  return {
    name: food.name,
    amount: food.estimatedAmount,
    unit: food.unit,
    ...(food.entryId ? { entryId: food.entryId } : {}),
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    ...pickMicronutrients(food),
  };
}

/** Convert an editable row to the persisted breakdown shape. Returns null
 *  for unnamed rows: totals stay authoritative, but the breakdown only
 *  keeps identifiable foods. All 16 nutrients (macros parsed from the
 *  text fields + opaque micros) travel through. */
export function foodRowToMealFood(row: FoodRow): MealFood | null {
  const name = row.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    ...(row.entryId ? { entryId: row.entryId } : {}),
    amount: parseOptionalNumber(row.amount),
    unit: row.unit.trim() || undefined,
    calories: parseRowNumber(row.calories),
    protein: parseRowNumber(row.protein),
    carbs: parseRowNumber(row.carbs),
    fat: parseRowNumber(row.fat),
    ...row.micros,
  };
}

/**
 * Re-derive a row's nutrition from its current amount and unit — called
 * on every amount/unit edit so meal totals update instantly with no
 * manual recalculation and no network call. Catalog-linked rows scale
 * from the DB portion (Food DB wins, S6A #2); other rows scale all 16
 * nutrients from their stable `baseNutrition` snapshot (manual entries,
 * reopened values) — never from already-scaled values.
 * Rows with neither scale from keep their nutrition as typed, and
 * blank/invalid amounts contribute 0 (same rule the sheet has always
 * used for row numbers).
 */
export function rescaleFoodRow(row: FoodRow): FoodRow {
  const entry = row.entryId
    ? getFoodEntry(row.entryId)
    : undefined;

  if (entry && isSameUnit(row.unit, entry.unit)) {
    const scaled = scalePortionMacros(entry, parseRowNumber(row.amount));

    return {
      ...row,
      calories: String(scaled.calories),
      protein: String(scaled.protein),
      carbs: String(scaled.carbs),
      fat: String(scaled.fat),
      micros: pickMicronutrients(scaled),
    };
  }

  if (
    !entry &&
    row.baseAmount !== undefined &&
    row.baseAmount > 0 &&
    row.baseNutrition
  ) {
    const ratio = parseRowNumber(row.amount) / row.baseAmount;
    const round2 = (value: number) =>
      Math.round(value * 100) / 100;
    const scaled: MacroTotals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    for (const key of NUTRIENT_KEYS) {
      scaled[key] = round2((row.baseNutrition[key] ?? 0) * ratio);
    }

    return {
      ...row,
      calories: String(scaled.calories),
      protein: String(scaled.protein),
      carbs: String(scaled.carbs),
      fat: String(scaled.fat),
      micros: pickMicronutrients(scaled),
    };
  }

  return row;
}

/**
 * True when a busy-guarded text action may start: nothing in flight and
 * non-blank trimmed input. Shared by the Add Food resolve button and the
 * meal review's food resolver so duplicate submissions are blocked
 * identically in both places (S6A #8).
 */
export function canStartAnalysis(
  inFlight: boolean,
  text: string,
): boolean {
  return !inFlight && text.trim() !== "";
}

export type FoodLookup = {
  /** Food name/description exactly as typed. */
  description: string;
  /** Explicit amount field, when the user filled it in. */
  amount?: number;
  /** Explicit unit field, when the user filled it in. */
  unit?: string;
};

export type FoodResolveResult =
  | { status: "resolved"; foods: EstimatedFood[] }
  /** No confident catalog match: rows carry `unresolved: true` and zero
   *  macros so the review sheet shows "Nutrition needed" instead of
   *  fabricated values. Nothing is guessed, substituted, or fetched. */
  | { status: "unresolved"; foods: EstimatedFood[] }
  /** Nothing usable: blank input. */
  | { status: "none" };

/**
 * Apply one field patch to a review row, refreshing the stable scaling
 * base when hand-typed macros land on a non-catalog row (so a later
 * quantity edit rescales the entered values instead of freezing them).
 * Catalog rows always scale from the DB portion. Sibling fields are
 * never touched: each macro/micro/amount/unit edit only writes its own
 * key. Pure — shared by the sheet's update paths so the rule is tested
 * once, in one place.
 */
export function applyFoodRowPatch(
  row: FoodRow,
  patch: Partial<FoodRow>,
): FoodRow {
  const next = { ...row, ...patch };

  if (
    !next.entryId &&
    (patch.calories !== undefined ||
      patch.protein !== undefined ||
      patch.carbs !== undefined ||
      patch.fat !== undefined)
  ) {
    return establishRowBase(next);
  }

  return next;
}

/**
 * Split a leading quantity from a typed food name — "1.5 tbsp ghee",
 * "200g rice", "2 banana". The unit is only consumed when text follows
 * it, so a unit-less amount keeps the whole remainder as the name.
 * A leading "a"/"an" counts as a portion of one ("a banana").
 * Returns the input unchanged when there is no quantity lead.
 */
function parseLeadingQuantity(text: string): {
  name: string;
  amount?: number;
  unit?: string;
} {
  const single = text.match(/^(a|an)\s+(.+)$/i);

  if (single) {
    return { name: (single[2] ?? "").trim(), amount: 1 };
  }

  const match = text.match(/^([\d.]+)(?:\s*([a-zA-Z]+))?\s+(.+)$/);

  if (!match) {
    return { name: text };
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { name: text };
  }

  return {
    name: (match[3] ?? "").trim(),
    amount,
    ...(match[2] ? { unit: match[2] } : {}),
  };
}

/**
 * Resolve a structured (name, amount, unit) triple against the catalog:
 * exact normalized match incl. everyday aliases, scaled within the
 * catalog's own unit. Returns undefined on no confident match. On a
 * name match with an inconvertible unit, returns undefined by default —
 * or, with `retainEntryOnUnitMismatch`, an explicitly-unresolved row
 * that keeps the catalog link so the review can offer the entry's unit
 * (macros stay zero/"unknown"; nothing is scaled across units).
 * The single choke point every local resolution scales through, so Food
 * DB precedence is identical everywhere.
 */
function resolveFoodByName(
  name: string,
  amount: number | undefined,
  unit: string,
  opts?: { retainEntryOnUnitMismatch?: boolean },
): EstimatedFood | undefined {
  if (!name) {
    return undefined;
  }

  const entry = matchFoodEntry(name, 3);

  if (!entry) {
    return undefined;
  }

  const finalAmount =
    amount !== undefined && Number.isFinite(amount) && amount > 0
      ? amount
      : entry.amount;

  // A stated unit other than the catalog's would need a conversion this
  // app does not do.
  if (unit !== "" && !isSameUnit(unit, entry.unit)) {
    if (!opts?.retainEntryOnUnitMismatch) {
      return undefined;
    }

    return {
      name: entry.name,
      estimatedAmount: finalAmount,
      unit,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      entryId: entry.id,
      unresolved: true,
      nutritionSource: "food-db",
    };
  }

  const scaled = scalePortionMacros(entry, finalAmount);

  return {
    name: entry.name,
    estimatedAmount: finalAmount,
    unit: entry.unit,
    entryId: entry.id,
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    ...pickMicronutrients(scaled),
    nutritionSource: "food-db",
  };
}

/**
 * Offline catalog resolution: an EXACT normalized-name match only
 * (matchFoodEntry minScore 3, incl. everyday aliases like yogurt→curd).
 * Anything less reliable — a bare "rice", or a "homemade paneer curry"
 * that merely contains a catalog name — resolves to nothing so a
 * user-stated food is never silently swapped for a near-name. Nutrition
 * scales within the catalog's own unit; a stated unit we cannot convert
 * also resolves to nothing. Explicit amount/unit fields win over
 * quantities parsed from the text; with neither, the entry's own portion
 * is used.
 */
function resolveFromFoodDb(
  raw: string,
  explicit?: { amount?: number; unit?: string },
): EstimatedFood | undefined {
  const parsed = parseLeadingQuantity(raw);

  if (!parsed.name) {
    return undefined;
  }

  const explicitAmount =
    explicit?.amount !== undefined &&
    Number.isFinite(explicit.amount) &&
    explicit.amount > 0
      ? explicit.amount
      : undefined;

  return resolveFoodByName(
    parsed.name,
    explicitAmount ?? parsed.amount,
    explicit?.unit?.trim() || parsed.unit || "",
    { retainEntryOnUnitMismatch: true },
  );
}

/**
 * Match a parsed food name against the user's own saved foods
 * (resolution priority #2, after the Food DB): exact normalized-name
 * equality over individual saved foods only. Saved MEALS stay
 * explicit-UI-only, and entries without stored calories can't serve as
 * a source. The user's own numbers need no network and no guessing.
 */
export function matchSavedFood(
  name: string,
  savedFoods?: SavedFood[] | null,
): SavedFood | undefined {
  const list = Array.isArray(savedFoods) ? savedFoods : [];
  const q = normalizeFoodName(name);

  if (!q) {
    return undefined;
  }

  return list.find(
    (saved) =>
      !!saved &&
      typeof saved.name === "string" &&
      normalizeFoodName(saved.name) === q &&
      !(saved.foods && saved.foods.length > 0) &&
      typeof saved.calories === "number" &&
      Number.isFinite(saved.calories),
  );
}

/**
 * Resolve a structured (name, amount, unit) triple from a saved-food
 * match: the user's stored macros/micros apply as-is (no catalog
 * portion exists to scale from — the parsed quantity labels the row).
 * No `entryId` (nothing to rescale from) and no `unresolved` flag: the
 * user's own stored numbers ARE the record, and `toFoodRow` seeds a
 * scaling base from them automatically.
 */
function resolveFromSavedFood(
  name: string,
  amount: number | undefined,
  unit: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood | undefined {
  const saved = matchSavedFood(name, savedFoods);

  if (!saved) {
    return undefined;
  }

  const num = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    name: saved.name,
    estimatedAmount:
      amount !== undefined && Number.isFinite(amount) && amount > 0
        ? amount
        : 1,
    unit,
    calories: num(saved.calories),
    protein: num(saved.protein),
    carbs: num(saved.carbs),
    fat: num(saved.fat),
    ...pickMicronutrients(saved),
    nutritionSource: "manual",
  };
}

/**
 * Build an explicitly-unresolved food: parsed name/amount/unit travel
 * through, every macro is zero, no micros are claimed, no catalog link
 * is recorded. The review sheet renders "Nutrition needed" for these —
 * zero here means "unknown", never a real measurement.
 */
function unresolvedFood(raw: string): EstimatedFood {
  const text = raw.trim();
  const parsed = parseLeadingQuantity(text);
  const name = parsed.name || text;

  return {
    name,
    estimatedAmount: parsed.amount ?? 1,
    unit: parsed.unit ?? "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    unresolved: true,
    nutritionSource: "manual",
  };
}

/**
 * Resolve one food segment locally: exact catalog match with scaled
 * 16-nutrient nutrition, then the user's own saved foods, otherwise an
 * explicitly-unresolved row for manual entry. Pure, synchronous,
 * offline — no network, no provider, no fabrication.
 */
export function resolveSegmentLocally(
  segment: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood {
  const text = segment.trim();

  if (!text) {
    return unresolvedFood(text);
  }

  const parsed = parseLeadingQuantity(text);
  const amount = parsed.amount;
  const unit = parsed.unit ?? "";

  return (
    resolveFromFoodDb(text) ??
    (parsed.name
      ? resolveFromSavedFood(parsed.name, amount, unit, savedFoods)
      : undefined) ??
    unresolvedFood(text)
  );
}

/**
 * Resolve a whole description locally: split into segments, resolve
 * each against the Food DB then saved foods. Every distinct food becomes
 * its own row — resolved rows carry catalog/user nutrition, the rest
 * carry `unresolved: true` for manual entry. Blank input yields no rows.
 */
export function resolveMealDescription(
  description: string,
  savedFoods?: SavedFood[] | null,
): EstimatedFood[] {
  const text = description.trim();

  if (!text) {
    return [];
  }

  return splitDescriptionSegments(text).map((segment) =>
    resolveSegmentLocally(segment, savedFoods),
  );
}

/**
 * Staged resolution outcome: either nothing to resolve, or a reviewable
 * estimate. Resolution is fully local, so there is no delivery notice —
 * the rows speak for themselves.
 */
export type StagedResolution =
  | { status: "empty" }
  | {
      status: "resolved";
      estimate: MealEstimate;
    };

/**
 * Staged local description resolution for determinate progress UI.
 *
 * Split + resolve locally (synchronous): every segment resolves against
 * the Food DB first, then the user's saved foods; anything left becomes
 * an unresolved manual row. Nothing throws, nothing blocks, nothing is
 * queued, nothing touches the network.
 *
 * Reports cumulative completed work units after each real step (parse →
 * each finalized food → totals). `yieldToPaint` defaults to a microtask
 * (fast in tests); the UI passes a macrotask so each stage paints.
 * Totals are always computed locally.
 */
export async function resolveMealDescriptionStaged(
  description: string,
  onProgress?: (update: ResolutionProgress) => void,
  yieldToPaint: () => Promise<void> = () => Promise.resolve(),
  savedFoods?: SavedFood[] | null,
): Promise<StagedResolution> {
  const text = description.trim();

  if (!text) {
    return { status: "empty" };
  }

  const segments = splitDescriptionSegments(text);

  if (segments.length === 0) {
    return { status: "empty" };
  }

  // Local resolution (synchronous, instant): Food DB, then saved foods,
  // then unresolved manual rows — decided up front so every progress
  // update maps to final rows.
  const foods: EstimatedFood[] = segments.map((segment) =>
    resolveSegmentLocally(segment, savedFoods),
  );

  const total = foods.length + 2;
  let done = 0;

  onProgress?.({
    stageIndex: 0,
    label: RESOLUTION_STAGES[0],
    detail:
      foods.length === 1 ? "1 food" : `${foods.length} foods`,
    current: ++done,
    total,
  });
  await yieldToPaint();

  const finalFoods: EstimatedFood[] = [];

  for (let index = 0; index < foods.length; index++) {
    finalFoods.push(foods[index]);
    onProgress?.({
      stageIndex: 1,
      label: RESOLUTION_STAGES[1],
      detail: `${index + 1} of ${foods.length}`,
      current: ++done,
      total,
    });
    await yieldToPaint();
  }

  const totals = computeMealTotals(finalFoods);
  onProgress?.({
    stageIndex: 2,
    label: RESOLUTION_STAGES[2],
    detail: "Totals ready",
    current: ++done,
    total,
  });
  await yieldToPaint();

  return { status: "resolved", estimate: { foods: finalFoods, totals } };
}

/**
 * Apply the local Food DB precedence rule to an AI estimate.
 *
 * The AI owns food identity and parsing. For each returned food we may
 * replace only its nutrition with a reliable, unit-compatible catalog
 * value scaled to the stated amount. The user-facing name and unit stay
 * exactly as the AI returned them. Unknown foods retain their AI values;
 * they are never replaced with a guessed local food.
 */
export function applyFoodDbPrecedence(
  estimate: MealEstimate,
): MealEstimate {
  const foods = estimate.foods.map((food) => {
    const entry = matchFoodEntry(food.name, 3);

    if (!entry || !isSameUnit(food.unit, entry.unit)) {
      return {
        ...food,
        nutritionSource: "ai" as const,
      };
    }

    const scaled = scalePortionMacros(entry, food.estimatedAmount);

    return {
      ...food,
      entryId: entry.id,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      ...pickMicronutrients(scaled),
      nutritionSource: "food-db" as const,
    };
  });

  return {
    foods,
    totals: computeMealTotals(foods),
  };
}

export type DescriptionResolutionResult =
  | StagedResolution
  | {
      status: "failed";
      error: DescriptionAiError;
    };

function asDescriptionAiError(error: unknown): DescriptionAiError {
  return error instanceof DescriptionAiError
    ? error
    : new DescriptionAiError(
        "network",
        "Description AI provider failed",
        undefined,
        error,
      );
}

/**
 * Resolve a description through the optional description AI provider.
 *
 * With no provider configured this delegates to the existing local
 * Food DB/saved-food/manual path. With a provider configured, failure is
 * returned as a typed result and is never converted into a fake local
 * estimate. The future offline queue can consume that failure without
 * this slice adding queue or retry behavior.
 */
export async function resolveMealDescriptionWithProviderStaged(
  description: string,
  onProgress?: (update: ResolutionProgress) => void,
  yieldToPaint: () => Promise<void> = () => Promise.resolve(),
  savedFoods?: SavedFood[] | null,
  provider?: DescriptionAiProvider | null,
): Promise<DescriptionResolutionResult> {
  const text = description.trim();

  if (!text) {
    return { status: "empty" };
  }

  const activeProvider =
    provider === undefined
      ? getDescriptionAiProvider()
      : provider;

  if (!activeProvider) {
    return resolveMealDescriptionStaged(
      text,
      onProgress,
      yieldToPaint,
      savedFoods,
    );
  }

  let done = 0;
  onProgress?.({
    stageIndex: 0,
    label: RESOLUTION_STAGES[0],
    detail: "Description sent",
    current: ++done,
    total: 3,
  });
  await yieldToPaint();

  let aiEstimate: MealEstimate;

  try {
    const rawEstimate = await activeProvider.estimate(text);
    // Validate custom providers as well as the Render client. This keeps
    // the 16-nutrient contract honest before anything reaches review.
    aiEstimate = parseDescriptionAiEstimate(rawEstimate);
  } catch (error) {
    return { status: "failed", error: asDescriptionAiError(error) };
  }

  const estimate = applyFoodDbPrecedence(aiEstimate);
  const total = estimate.foods.length + 2;

  for (let index = 0; index < estimate.foods.length; index++) {
    onProgress?.({
      stageIndex: 1,
      label: RESOLUTION_STAGES[1],
      detail: `${index + 1} of ${estimate.foods.length}`,
      current: ++done,
      total,
    });
    await yieldToPaint();
  }

  onProgress?.({
    stageIndex: 2,
    label: RESOLUTION_STAGES[2],
    detail: "Totals ready",
    current: ++done,
    total,
  });
  await yieldToPaint();

  return { status: "resolved", estimate };
}

/** Alias with the shorter AI-oriented name for callers/tests. */
export const resolveMealDescriptionWithAiStaged =
  resolveMealDescriptionWithProviderStaged;

/**
 * Resolve one "+ Add food" entry locally: exact Food DB match, then the
 * user's saved foods, otherwise a single explicitly-unresolved row for
 * manual entry. Synchronous and offline — no provider, no network, no
 * pending queue, no fabricated nutrition.
 */
export function resolveFoodForMeal(
  input: FoodLookup,
  savedFoods?: SavedFood[] | null,
): FoodResolveResult {
  const raw = input.description.trim();

  if (!raw) {
    return { status: "none" };
  }

  const amount =
    input.amount !== undefined &&
    Number.isFinite(input.amount) &&
    input.amount > 0
      ? input.amount
      : undefined;
  const unit = input.unit?.trim() || undefined;

  const local = resolveFromFoodDb(raw, { amount, unit });

  if (local) {
    // A name match with an inconvertible unit still arrives unresolved
    // (zero macros + catalog link for the "Use {unit}" hint) — never as
    // a resolved row.
    return local.unresolved === true
      ? { status: "unresolved", foods: [local] }
      : { status: "resolved", foods: [local] };
  }

  const parsed = parseLeadingQuantity(raw);

  if (parsed.name) {
    const saved = resolveFromSavedFood(
      parsed.name,
      amount ?? parsed.amount,
      unit ?? parsed.unit ?? "",
      savedFoods,
    );

    if (saved) {
      return { status: "resolved", foods: [saved] };
    }
  }

  return { status: "unresolved", foods: [unresolvedFood(raw)] };
}