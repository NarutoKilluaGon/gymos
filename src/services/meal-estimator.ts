/**
 * Quick meal estimates from a curated catalog + AI vision provider.
 *
 * V1: curated list of common meals with estimated macros (QUICK_MEALS).
 * The user taps one → it pre-fills the MealSheet (name + macros) → they can
 * edit before saving. No manual macro entry needed for the most common foods.
 *
 * A vision provider (photo → AI macros) plugs in behind `estimateMealFromPhoto`,
 * which stays as the scan entry point. Without a provider configured it falls
 * back to the curated catalog, phrased honestly as a quick-pick rather than
 * pretending to "read" the photo.
 */

import * as ImagePicker from "expo-image-picker";

import type { MealInput } from "@/components/quick-add/meal-sheet";
import { showToast } from "@/utils/toast";

export type MealEstimate = MealInput;

/** Curated common meals with estimated macros, searchable by name. */
export const QUICK_MEALS: MealEstimate[] = [
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

  if (!q) {
    return QUICK_MEALS;
  }

  return QUICK_MEALS.filter((meal) =>
    meal.name.toLowerCase().includes(q),
  );
}

/**
 * Vision provider interface — plug in any AI vision service.
 * Implementations should analyze a food photo URI and return estimated macros.
 */
export interface VisionProvider {
  /** Unique name for logging/debugging. */
  name: string;
  /** Analyze a food photo and return estimated macros. */
  estimate(uri: string): Promise<MealEstimate | null>;
}

/** Current vision provider (null = no AI, fallback to quick-pick catalog). */
let visionProvider: VisionProvider | null = null;

/** Set the vision provider (call once at app startup or in tests). */
export function setVisionProvider(provider: VisionProvider | null): void {
  visionProvider = provider;
}

/** Get the current vision provider. */
export function getVisionProvider(): VisionProvider | null {
  return visionProvider;
}

/**
 * Mock vision provider for development/testing.
 * Returns realistic-ish macros based on simple heuristics from the filename.
 */
export const mockVisionProvider: VisionProvider = {
  name: "mock",
  async estimate(uri: string): Promise<MealEstimate | null> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1200));

    // Derive a deterministic "estimate" from the URI hash
    let hash = 0;
    for (let i = 0; i < uri.length; i++) {
      hash = ((hash << 5) - hash + uri.charCodeAt(i)) | 0;
    }
    const seed = Math.abs(hash);

    // Pick a base meal from the catalog and vary it slightly
    const base = QUICK_MEALS[seed % QUICK_MEALS.length];
    const variance = 0.85 + (seed % 30) / 100; // 0.85–1.14

    return {
      name: `AI: ${base.name}`,
      calories: Math.round((base.calories ?? 0) * variance),
      protein: Math.round((base.protein ?? 0) * variance),
      carbs: Math.round((base.carbs ?? 0) * variance),
      fat: Math.round((base.fat ?? 0) * variance),
    };
  },
};

/**
 * Scan entry point. Captures a photo, then runs it through the configured
 * vision provider. Returns the estimated macros, or null if the user cancels
 * or no provider is configured (falls back to quick-pick catalog on the screen).
 */
export async function estimateMealFromPhoto(): Promise<MealEstimate | null> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    showToast("Photo library permission needed");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  const uri = result.assets?.[0]?.uri;
  if (!uri) {
    showToast("Couldn't get photo");
    return null;
  }

  const provider = getVisionProvider();
  if (!provider) {
    // No AI provider configured → signal to open quick-pick catalog instead
    return null;
  }

  try {
    showToast(`Analyzing with ${provider.name}…`);
    const estimate = await provider.estimate(uri);
    if (estimate) {
      showToast("Photo analyzed — review macros before saving");
    }
    return estimate;
  } catch (error) {
    console.error("[vision] estimate failed:", error);
    showToast("Couldn't analyze photo");
    return null;
  }
}