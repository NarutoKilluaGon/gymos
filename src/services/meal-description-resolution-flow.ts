/**
 * The end-to-end description resolution flow used by "+ Add food":
 * split → resolve each segment (local-only path), or send the whole
 * description to a provider and apply Food DB precedence (AI-assisted
 * path) — either way reporting determinate progress as real work
 * completes, never an arbitrary percentage.
 */

import type { EstimatedFood } from "@/components/quick-add/meal-sheet";
import {
  DescriptionAiError,
  getDescriptionAiProvider,
  parseDescriptionAiEstimate,
  type DescriptionAiProvider,
  type MealEstimate,
} from "@/services/meal-description-ai-provider";
import { splitDescriptionSegments } from "@/services/meal-description-parsing";
import {
  applyFoodDbPrecedence,
  resolveSegmentLocally,
} from "@/services/meal-food-resolution";
import { computeMealTotals } from "@/services/meal-nutrition-math";
import type { SavedFood } from "@/storage/repositories/saved-foods";

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
 * estimate. The offline queue (description-ai-queue.ts) consumes that
 * failure without this function adding any queue or retry behavior
 * itself.
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
