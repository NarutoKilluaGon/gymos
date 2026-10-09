import { computeMealTotals } from "@/services/meal-nutrition-math";
import {
  DEFAULT_SLOT_TIME,
  slotOfMeal,
  timeOfDay,
  slotForTime,
} from "@/services/nourish/slots";
import { scaleNutrients } from "@/services/nourish/nutrition";
import {
  addMeals,
  type MacroTotals,
  type MealPatch,
  type NewMeal,
} from "@/storage/repositories/meals";
import {
  addSavedFood,
  rememberFoods,
  replaceRecipe,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import {
  NUTRIENT_KEYS,
  pickMicronutrients,
  type Meal,
  type MealFood,
  type MealSlot,
} from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { getTodayKey, timestampForKey } from "@/utils/date";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Every numeric nutrient present on a record (unknown stays absent). */
export function nutritionOf(source: object): Partial<MacroTotals> {
  const out: Record<string, number> = {};
  const record = source as Record<string, unknown>;

  for (const key of NUTRIENT_KEYS) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }

  return out as Partial<MacroTotals>;
}

/** "2× 1 katori" style label once a portion has been scaled. */
export function scaledQty(qty: string | undefined, factor: number): string {
  const base = qty?.trim() || "1 serving";

  return factor === 1 ? base : `${factor}× ${base}`;
}

/** When a new entry is timestamped: the chosen clock time, else the
 *  section's usual time so it still lands in the right place. */
export function entryTimestamp(
  dayKey: string,
  at: string | null,
  slot: MealSlot,
): string {
  return timestampForKey(dayKey, at ?? DEFAULT_SLOT_TIME[slot]);
}

export function draftToNewMeal(
  item: DraftItem,
  slot: MealSlot,
  timestamp: string,
): NewMeal {
  const scaled = scaleNutrients(
    {
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      ...pickMicronutrients(item),
    },
    item.multiplier,
  );

  return {
    name: item.name,
    macros: scaled,
    slot,
    qty: scaledQty(item.qty, item.multiplier),
    confidence: item.confidence,
    timestamp,
  };
}

/** Save confirmed items as diary entries and remember them as usual
 *  foods. Entries are written first; remembering is best-effort so a
 *  failure there never loses the log. */
export async function saveDraft(input: {
  items: readonly DraftItem[];
  slot: MealSlot;
  /** "HH:MM", or null for a day with no clock time. */
  at: string | null;
  dayKey: string;
}): Promise<Meal[]> {
  const timestamp = entryTimestamp(input.dayKey, input.at, input.slot);
  const saved = await addMeals(
    input.items.map((item) => draftToNewMeal(item, input.slot, timestamp)),
  );

  try {
    await rememberFoods(
      input.items.map((item) => {
        const scaled = scaleNutrients(
          {
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            ...pickMicronutrients(item),
          },
          item.multiplier,
        );

        return {
          name: item.name,
          qty: scaledQty(item.qty, item.multiplier),
          ...scaled,
        };
      }),
    );
  } catch {
    // The entries are already saved.
  }

  return saved;
}

/** Patch that scales an entry's whole portion and optionally moves it. */
export function scaleEntryPatch(
  meal: Meal,
  options: {
    factor: number;
    slot: MealSlot;
    /** "HH:MM" to set, or empty/undefined to leave the time alone. */
    at?: string;
    dayKey: string;
  },
): MealPatch {
  const macros =
    options.factor === 1
      ? undefined
      : scaleNutrients(nutritionOf(meal), options.factor);

  return {
    ...(macros ? { macros } : {}),
    ...(options.factor !== 1
      ? { qty: scaledQty(meal.qty, options.factor) }
      : {}),
    slot: options.slot,
    ...(options.at
      ? { timestamp: timestampForKey(options.dayKey, options.at) }
      : {}),
  };
}

/** Copy one day's entries onto another day, keeping slots and times. */
export async function repeatDay(
  sourceMeals: readonly Meal[],
  toKey: string,
): Promise<Meal[]> {
  const inputs: NewMeal[] = sourceMeals.map((meal) => {
    const slot = slotOfMeal(meal);

    return {
      name: meal.name,
      macros: nutritionOf(meal),
      slot,
      ...(meal.qty ? { qty: meal.qty } : {}),
      ...(typeof meal.confidence === "number"
        ? { confidence: meal.confidence }
        : {}),
      timestamp: timestampForKey(
        toKey,
        timeOfDay(meal.timestamp) ?? DEFAULT_SLOT_TIME[slot],
      ),
    };
  });

  return addMeals(inputs);
}

function mealFoodOf(meal: Meal): MealFood {
  return {
    name: meal.name,
    ...(meal.qty ? { qty: meal.qty } : {}),
    ...(typeof meal.confidence === "number"
      ? { confidence: meal.confidence }
      : {}),
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    ...pickMicronutrients(meal),
  };
}

/** Save one section's entries as a one-tap meal. */
export async function saveSlotAsMeal(
  meals: readonly Meal[],
  slot: MealSlot,
): Promise<SavedFood | null> {
  if (meals.length === 0) return null;

  const foods = meals.map(mealFoodOf);

  return addSavedFood(
    `Usual ${slot.toLowerCase()}`,
    computeMealTotals(foods),
    foods,
    { slot },
  );
}

/** Log a saved meal, food, or recipe on a day, as diary entries. */
export async function logSavedMeal(
  saved: SavedFood,
  dayKey: string,
  now: Date = new Date(),
  options?: {
    slot?: MealSlot;
    servingsMultiplier?: number;
  },
): Promise<Meal[]> {
  const mult =
    options?.servingsMultiplier !== undefined &&
    Number.isFinite(options.servingsMultiplier) &&
    options.servingsMultiplier > 0
      ? options.servingsMultiplier
      : 1;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const slot = options?.slot ?? saved.slot ?? slotForTime(hm);
  const timestamp =
    dayKey === getTodayKey()
      ? now.toISOString()
      : entryTimestamp(dayKey, null, slot);

  const isMeal = saved.foods !== undefined && saved.foods.length > 0;

  if (isMeal) {
    return addMeals(
      saved.foods!.map((food) => ({
        name: food.name,
        macros: mult !== 1 ? scaleNutrients(nutritionOf(food), mult) : nutritionOf(food),
        slot,
        ...(food.qty
          ? { qty: mult !== 1 ? `${mult}× ${food.qty}` : food.qty }
          : {}),
        ...(typeof food.confidence === "number"
          ? { confidence: food.confidence }
          : {}),
        timestamp,
      })),
    );
  }

  // Single food or recipe
  const portionSuffix =
    mult === 0.5
      ? " (½ serving)"
      : mult === 1.5
        ? " (1½ servings)"
        : mult !== 1
          ? ` (${mult} servings)`
          : "";
  const qty = saved.qty
    ? `${saved.qty}${portionSuffix}`
    : mult !== 1
      ? `${mult} servings`
      : undefined;

  return addMeals([
    {
      name: saved.name,
      macros: scaleNutrients(
        {
          calories: saved.calories ?? 0,
          protein: saved.protein ?? 0,
          carbs: saved.carbs ?? 0,
          fat: saved.fat ?? 0,
          ...pickMicronutrients(saved),
        },
        mult,
      ),
      slot,
      ...(qty ? { qty } : {}),
      confidence: 0.9,
      timestamp,
    },
  ]);
}

/** Per-serving nutrition for a recipe's resolved ingredients. */
export function recipePerServing(
  items: readonly DraftItem[],
  servings: number,
): Omit<DraftItem, "name" | "qty" | "multiplier" | "source"> {
  const safeServings = servings > 0 ? servings : 1;
  const totals = computeMealTotals(
    items.map((item) => ({
      name: item.name,
      ...scaleNutrients(
        {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...pickMicronutrients(item),
        },
        item.multiplier,
      ),
    })),
  );
  const perServing: Record<string, number> = {};

  for (const key of NUTRIENT_KEYS) {
    const value = totals[key];

    if (typeof value === "number") {
      perServing[key] = round2(value / safeServings);
    }
  }

  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...perServing,
    confidence: Math.min(0.85, ...items.map((item) => item.confidence)),
  };
}

/** Save (or replace) a recipe as a per-serving saved food with ingredients stored. */
export async function saveRecipe(
  name: string,
  items: readonly DraftItem[],
  servings: number,
): Promise<SavedFood> {
  const { confidence, ...nutrition } = recipePerServing(items, servings);

  void confidence;

  // One atomic repository operation: a failed save keeps the old recipe.
  return replaceRecipe(name, nutrition, items, servings);
}

