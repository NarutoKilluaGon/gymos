import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";

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
  updateMealById,
  type NewMeal,
} from "@/storage/repositories/meals";
import {
  addMeasurement,
  deleteMeasurement,
  getMeasurements,
} from "@/storage/repositories/measurements";
import {
  deleteSavedFood,
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { Meal, MealSlot } from "@/types/gymos";
import type {
  CardioLog,
  CardioMap,
  DraftItem,
  FeelMap,
  FeelValue,
  NourishSettings,
} from "@/types/nourish";
import { showToast } from "@/utils/toast";
import { getTodayKey } from "@/utils/date";
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

  const reload = useCallback(async () => {
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
      showToast("Couldn't load nutrition");
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
      }) => act(() => saveDraft(input), "Couldn't save"),
      addEntries: (entries: readonly NewMeal[]) =>
        act(() => addMeals(entries), "Couldn't save"),
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
      logSaved: (saved: SavedFood, dayKey: string) =>
        actOnce("logSaved", () => logSavedMeal(saved, dayKey), "Couldn't log"),
      removeSaved: (id: string) =>
        act(() => deleteSavedFood(id), "Couldn't delete"),
      addRecipe: (name: string, items: readonly DraftItem[], servings: number) =>
        act(() => saveRecipe(name, items, servings), "Couldn't save recipe"),
      addCardio: (
        dayKey: string,
        entry: Omit<CardioLog, "id" | "loggedAt">,
      ) => act(() => addCardioLog(dayKey, entry), "Couldn't save cardio"),
      removeCardio: (dayKey: string, id: string) =>
        act(() => removeCardioLog(dayKey, id), "Couldn't remove"),
      saveSettings: (settings: NourishSettings) =>
        act(() => saveNourishSettings(settings), "Couldn't save targets"),
      /** Replace today's weight (one reading per day). */
      logWeight: (value: number) =>
        act(async () => {
          const today = getTodayKey();
          const existing = data?.weights.find((w) => w.key === today);

          if (existing) await deleteMeasurement(existing.id);

          await addMeasurement("weight", value, unit);
        }, "Couldn't save weight"),
      removeWeight: (id: string) =>
        act(() => deleteMeasurement(id), "Couldn't delete"),
    }),
    [act, actOnce, data, unit],
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
