/**
 * Barrel for the food-estimation engine behind the Nourish logger.
 *
 *   meal-description-ai-provider.ts     the AI proxy transport
 *   meal-nutrition-math.ts              pure totals math
 *   meal-description-parsing.ts         splitting/parsing typed text
 *   meal-food-resolution.ts             food catalog + saved-food matching
 *   meal-description-resolution-flow.ts ties the above together
 *
 * The Nourish diary (src/services/nourish/*) builds on these; nothing
 * here knows about screens.
 */

export type {
  DescriptionAiErrorCode,
  DescriptionAiProvider,
  MealEstimate,
  RenderDescriptionAiProviderOptions,
} from "@/services/meal-description-ai-provider";
export {
  DescriptionAiError,
  createRenderDescriptionAiProvider,
  getDescriptionAiProvider,
  resetDescriptionAiProvider,
  setDescriptionAiProvider,
} from "@/services/meal-description-ai-provider";

export type { CanonicalMealNutritionInput } from "@/services/meal-nutrition-math";
export {
  canSaveReusableNutrition,
  computeMealTotals,
  hasCanonicalNutrition,
  toCanonicalMealNutrition,
} from "@/services/meal-nutrition-math";

export { splitDescriptionSegments } from "@/services/meal-description-parsing";

export type {
  FoodLookup,
  FoodResolveResult,
} from "@/services/meal-food-resolution";
export {
  applyFoodDbPrecedence,
  matchSavedFood,
  resolveFoodForMeal,
  resolveMealDescription,
  resolveSegmentLocally,
} from "@/services/meal-food-resolution";

export type {
  DescriptionResolutionResult,
  ResolutionProgress,
  StagedResolution,
} from "@/services/meal-description-resolution-flow";
export {
  RESOLUTION_STAGES,
  progressPercent,
  resolveMealDescriptionStaged,
  resolveMealDescriptionWithAiStaged,
  resolveMealDescriptionWithProviderStaged,
} from "@/services/meal-description-resolution-flow";
