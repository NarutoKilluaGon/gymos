import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDayModel,
  burnByDay,
  workoutCardioByDay,
  type BurnEntry,
  type DayModel,
} from "@/services/nourish/day-model";
import {
  saveDraft,
  logSavedMeal,
  repeatDay,
  saveRecipe,
  saveSlotAsMeal,
  scaleEntryPatch,
} from "@/services/nourish/diary";
import { buildRecords } from "@/services/nourish/insights";
import { weightPoints, toKg, type WeightPoint } from "@/services/nourish/weight";
import { getTimeline } from "@/services/timeline";
import {
  addCardioLog,
  getCardioMap,
  removeCardioLog,
  restoreCardioLog,
} from "@/storage/repositories/nourish-cardio";
import {
  getFeelMap,
  toggleFeel,
} from "@/storage/repositories/nourish-feel";
import {
  getNourishSettings,
  saveNourishSettings,
} from "@/storage/repositories/nourish-settings";
import {
  addMeals,
  deleteMeal,
  getAllMeals,
  restoreMeal,
  updateMealById,
  type NewMeal,
} from "@/storage/repositories/meals";
import {
  deleteMeasurement,
  getMeasurements,
  replaceTodayWeight,
  restoreMeasurement,
} from "@/storage/repositories/measurements";
import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  rememberFoods,
  restoreSavedFood,
  type RememberedFood,
  type SavedFood,
  type SavedFoodExtras,
} from "@/storage/repositories/saved-foods";
import type { Meal, MealFood, MealSlot, Measurement } from "@/types/gymos";
import type {
  CardioLog,
  CardioMap,
  DraftItem,
  FeelMap,
  FeelValue,
  NourishSettings,
} from "@/types/nourish";
import { showToast } from "@/utils/toast";
import { useWeightUnit } from "@/hooks/use-weight-unit";

export type NourishData = {
  meals: Meal[];
  feel: FeelMap;
  cardio: CardioMap;
  settings: NourishSettings;
  saved: SavedFood[];
  weights: WeightPoint[];
  workoutCardio: Record<string, BurnEntry[]>;
};

/**
 * Everything the Nutrition screens read, plus every write. Writes go
 * straight to the repositories and then re-read, so the screen always shows
 * what is actually stored (no optimistic state to drift).
 */
export function useNourish() {
  const [data, setData] = useState<NourishData | null>(null);
  const { unit } = useWeightUnit();

  // Identifies the newest reload. Reloads can overlap (focus, then a write's
  // refresh), and an older one can finish last holding an older snapshot, so
  // only the reload that is still the newest may commit. Bumped again on
  // unmount so a reload still in flight then commits (and toasts) nothing.
  const loadId = useRef(0);

  useEffect(() => {
    const ids = loadId;

    return () => {
      ids.current += 1;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++loadId.current;

    try {
      const [meals, feel, cardio, settings, saved, measurements, timeline] =
        await Promise.all([
          getAllMeals(),
          getFeelMap(),
          getCardioMap(),
          getNourishSettings(),
          getSavedFoods(),
          getMeasurements("weight"),
          // Workouts cardio is a bonus input; never block the screen on it.
          getTimeline().catch(() => []),
        ]);

      // Superseded by a newer reload (or unmounted): this snapshot is stale.
      if (id !== loadId.current) return;

      setData({
        meals,
        feel,
        cardio,
        settings,
        saved,
        weights: weightPoints(measurements),
        workoutCardio: workoutCardioByDay(timeline),
      });
    } catch {
      if (id === loadId.current) showToast("Couldn't load nutrition");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  /** Run a write, refresh, and report failure. Returns whether it worked. */
  const act = useCallback(
    async (write: () => Promise<unknown>, failure: string) => {
      try {
        await write();
      } catch {
        showToast(failure);
        await reload().catch(() => undefined);

        return false;
      }

      await reload().catch(() => undefined);

      return true;
    },
    [reload],
  );

  // Non-idempotent diary actions (they append entries) must not run twice
  // for one intent. A ref, not state, so a rapid second tap is blocked before
  // React re-renders. Held through the write AND the reload that follows,
  // because the UI only reflects the write once that reload lands.
  const inFlight = useRef(new Set<string>());

  /** Like `act`, but ignores a call while the same action is still running. */
  const actOnce = useCallback(
    async (name: string, write: () => Promise<unknown>, failure: string) => {
      if (inFlight.current.has(name)) return false;

      inFlight.current.add(name);

      try {
        return await act(write, failure);
      } finally {
        inFlight.current.delete(name);
      }
    },
    [act],
  );

  const records = useMemo(
    () =>
      data
        ? buildRecords(
            data.meals,
            data.feel,
            burnByDay(data.cardio, data.workoutCardio),
          )
        : null,
    [data],
  );

  const model = useCallback(
    (key: string): DayModel | null =>
      data
        ? buildDayModel({
            key,
            meals: data.meals,
            feel: data.feel,
            cardio: data.cardio,
            workoutCardio: data.workoutCardio,
            settings: data.settings,
          })
        : null,
    [data],
  );

  const latestWeightKg = data?.weights[data.weights.length - 1]?.kg;
  const weightKg = latestWeightKg ?? data?.settings.fallbackWeightKg ?? 65;

  const actions = useMemo(
    () => ({
      logDraft: (input: {
        items: readonly DraftItem[];
        slot: MealSlot;
        at: string | null;
        dayKey: string;
      }) => actOnce("logDraft", () => saveDraft(input), "Couldn't save"),
      addEntries: (entries: readonly NewMeal[]) =>
        actOnce("addEntries", () => addMeals(entries), "Couldn't save"),
      editEntry: (
        meal: Meal,
        options: {
          factor: number;
          slot: MealSlot;
          at?: string;
          dayKey: string;
        },
      ) =>
        act(
          () => updateMealById(meal.id, scaleEntryPatch(meal, options)),
          "Couldn't update",
        ),
      removeEntry: (id: string) =>
        act(() => deleteMeal(id), "Couldn't delete"),
      restoreEntry: (meal: Meal) =>
        act(() => restoreMeal(meal), "Couldn't restore"),
      setFeel: (dayKey: string, slot: MealSlot, value: FeelValue) =>
        act(() => toggleFeel(dayKey, slot, value), "Couldn't save"),
      repeatInto: (source: readonly Meal[], toKey: string) =>
        actOnce("repeatInto", () => repeatDay(source, toKey), "Couldn't repeat"),
      saveSection: (meals: readonly Meal[], slot: MealSlot) =>
        actOnce(
          "saveSection",
          () => saveSlotAsMeal(meals, slot),
          "Couldn't save meal",
        ),
      logSaved: (
        saved: SavedFood,
        dayKey: string,
        options?: { slot?: MealSlot; servingsMultiplier?: number },
      ) =>
        actOnce(
          "logSaved",
          () => logSavedMeal(saved, dayKey, new Date(), options),
          "Couldn't log",
        ),
      createSavedFood: (
        name: string,
        macros?: Partial<
          Pick<SavedFood, "calories" | "protein" | "carbs" | "fat">
        >,
        foods?: MealFood[],
        extras?: SavedFoodExtras,
      ) =>
        act(
          () => addSavedFood(name, macros, foods, extras),
          "Couldn't save food",
        ),
      removeSaved: (id: string) =>
        act(() => deleteSavedFood(id), "Couldn't delete"),
      restoreSaved: (food: SavedFood, index?: number) =>
        act(() => restoreSavedFood(food, index), "Couldn't restore"),
      rememberFood: (food: RememberedFood) =>
        act(() => rememberFoods([food]), "Couldn't save food"),
      addRecipe: (name: string, items: readonly DraftItem[], servings: number) =>
        act(() => saveRecipe(name, items, servings), "Couldn't save recipe"),
      addCardio: (
        dayKey: string,
        entry: Omit<CardioLog, "id" | "loggedAt">,
      ) =>
        actOnce(
          "addCardio",
          () => addCardioLog(dayKey, entry),
          "Couldn't save cardio",
        ),
      removeCardio: (dayKey: string, id: string) =>
        act(() => removeCardioLog(dayKey, id), "Couldn't remove"),
      restoreCardio: (dayKey: string, log: CardioLog, index?: number) =>
        act(() => restoreCardioLog(dayKey, log, index), "Couldn't restore cardio"),
      saveSettings: (settings: NourishSettings) =>
        act(() => saveNourishSettings(settings), "Couldn't save targets"),
      /** Replace today's weight (one reading per day, atomically). */
      logWeight: (value: number) =>
        act(() => replaceTodayWeight(value, unit), "Couldn't save weight"),
      removeWeight: (id: string) =>
        act(() => deleteMeasurement(id), "Couldn't delete"),
      restoreWeight: (point: WeightPoint | Measurement) =>
        act(() => {
          const measurement: Measurement =
            "timestamp" in point
              ? point
              : {
                  id: point.id,
                  type: "weight",
                  value: point.kg,
                  unit: "kg",
                  timestamp: `${point.key}T12:00:00.000Z`,
                };
          return restoreMeasurement(measurement);
        }, "Couldn't restore weight"),
    }),
    [act, actOnce, unit],
  );

  return {
    data,
    records,
    model,
    actions,
    reload,
    weightKg,
    weightUnit: unit,
    toKgInUnit: (value: number) => toKg(value, unit),
  };
}
