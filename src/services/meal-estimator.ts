/**
 * meal-estimator.ts is now a barrel, not an implementation.
 *
 * This file used to be ~1,700 lines doing five unrelated jobs: talking to
 * the AI proxy, parsing typed text, matching against the Food DB, editing
 * review rows, and converting between Meal/SavedFood/MealInput shapes.
 * That's been split into eight focused files (below), each independently
 * readable and independently testable.
 *
 * Every name that used to live in this file is still re-exported from
 * here, unchanged, so nothing that imports "@/services/meal-estimator"
 * needs to change. If you're touching nutrition code going forward,
 * import directly from the specific module you need instead — that's
 * the whole point of the split. This barrel exists only so the 9 files
 * that already depend on the old path don't all need editing today.
 *
 *   meal-description-ai-provider.ts   – the Render proxy transport
 *   meal-nutrition-math.ts            – pure totals/canonical-nutrition math
 *   meal-description-parsing.ts       – splitting/parsing typed text
 *   meal-food-resolution.ts           – Food DB + saved-food matching
 *   meal-row-editing.ts               – the editable review row (FoodRow)
 *   meal-mappers.ts                   – Meal/SavedFood/MealInput conversions
 *   quick-meals.ts                    – the curated QUICK_MEALS catalog
 *   meal-description-resolution-flow.ts – ties the above together with
 *                                          progress reporting
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

export type { FoodRow } from "@/services/meal-row-editing";
export {
  applyFoodRowPatch,
  canStartAnalysis,
  establishRowBase,
  foodRowToMealFood,
  rescaleFoodRow,
  toFoodRow,
} from "@/services/meal-row-editing";

export {
  estimatedFoodToMealFood,
  mealFoodsLine,
  mealInputForSave,
  mealInputFromEstimate,
  mealInputFromRecentMeal,
  mealToEstimate,
  recentFoodsFromMeals,
  savedFoodToEstimate,
} from "@/services/meal-mappers";

export { QUICK_MEALS, searchQuickMeals } from "@/services/quick-meals";

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
