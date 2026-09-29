import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EmptyMeals } from "@/components/nutrition/empty-meals";
import { AddMealSheet } from "@/components/nutrition/add-meal-sheet";
import { DayTimeline } from "@/components/nutrition/day-timeline";
import { NutritionSummaryCard } from "@/components/nutrition/nutrition-summary-card";
import { PendingDescriptionSection } from "@/components/nutrition/pending-description-section";
import { NutritionTargetsSheet } from "@/components/dashboard/nutrition-targets-sheet";
import { planReviewHandoff } from "@/services/review-handoff";
import {
  MealSheet,
  type MealInput,
} from "@/components/quick-add/meal-sheet";
import { FadeIn } from "@/components/ui/fade-in";
import { ModuleDisabled } from "@/components/ui/module-disabled";
import { useModules } from "@/contexts/modules-context";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { Plus, Utensils } from "lucide-react-native";
import {
  addMeal,
  deleteMeal,
  getTodayMeals,
  updateMeal,
  type MacroTotals,
} from "@/storage/repositories/meals";
import {
  getNutritionTargets,
  type NutritionTargets,
} from "@/storage/repositories/nutrition-targets";
import {
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import {
  getPendingDescriptionAnalyses,
  type PendingDescriptionAnalysis,
} from "@/storage/repositories/description-ai-queue";
import { getTodaySteps } from "@/storage/repositories/steps";
import { getTimeline } from "@/services/timeline";
import { buildDayTimeline } from "@/services/day-timeline";
import { calculateCalorieTarget } from "@/services/calorie-target";
import type { Meal } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";
import { getTodayKey } from "@/utils/date";
import { NUTRIENT_KEYS } from "@/types/gymos";
import { showToast } from "@/utils/toast";
import {
  mealInputFromEstimate,
  mealToEstimate,
  recentFoodsFromMeals,
  savedFoodToEstimate,
  toCanonicalMealNutrition,
  type MealEstimate,
} from "@/services/meal-estimator";
import {
  acknowledgePendingDescriptionReview,
  acknowledgePendingDescriptionReviewByDescription,
  canPresentPendingDescriptionReview,
  OFFLINE_DESCRIPTION_MESSAGE,
  retryPendingDescription,
  retryPendingDescriptions,
  type PendingDescriptionReviewAvailability,
} from "@/services/description-ai-queue";
import { subscribeToDescriptionAiRetryTriggers } from "@/services/description-ai-retry-triggers";

function sumMacros(meals: Meal[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (totals, meal) => {
      const next = { ...totals };

      for (const key of NUTRIENT_KEYS) {
        next[key] = (next[key] ?? 0) + (meal[key] ?? 0);
      }

      return next;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export default function NutritionScreen() {
  const { enabled } = useModules();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>({});
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // S7 targets sheet, exposed directly from Nutrition (§10): same sheet
  // the home tab uses — one implementation, one stored record.
  const [targetsSheetOpen, setTargetsSheetOpen] = useState(false);
  // S6: the rest of today's activity for the unified day timeline —
  // event-log items (workouts, cardio, …) plus the separate step count.
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [steps, setSteps] = useState(0);
  const [estimatedMeal, setEstimatedMeal] =
    useState<MealEstimate | null>(null);
  /** Which saved template seeded the open sheet (S4) — keeps its stored
   *  title instead of the joined food names. */
  const [selectedSavedMeal, setSelectedSavedMeal] =
    useState<SavedFood | null>(null);
  const [editingMeal, setEditingMeal] =
    useState<Meal | null>(null);
  const [pendingDescriptions, setPendingDescriptions] = useState<
    PendingDescriptionAnalysis[]
  >([]);
  const [retryingPendingId, setRetryingPendingId] =
    useState<string | null>(null);
  /** A retry is acknowledged only after the existing review sheet renders. */
  const [pendingReviewId, setPendingReviewId] = useState<
    string | null
  >(null);
  /** Direct description success may reconcile a matching queue item. */
  const [pendingReviewDescription, setPendingReviewDescription] =
    useState<string | null>(null);

  // Async retries can finish after the user opens/closes another surface.
  // Keep the handoff checks live rather than relying on a stale callback
  // closure from the render that started the request.
  const reviewAvailabilityRef =
    useRef<PendingDescriptionReviewAvailability>({
      screenMounted: true,
      screenFocused: false,
      nutritionEnabled: enabled.nutrition,
      addMealOpen,
      mealSheetOpen,
    });
  reviewAvailabilityRef.current = {
    screenMounted: reviewAvailabilityRef.current.screenMounted,
    screenFocused: reviewAvailabilityRef.current.screenFocused,
    nutritionEnabled: enabled.nutrition,
    addMealOpen,
    mealSheetOpen,
  };
  const pendingReviewHandoffRef = useRef(false);
  pendingReviewHandoffRef.current =
    pendingReviewId !== null || pendingReviewDescription !== null;

  useEffect(() => {
    reviewAvailabilityRef.current.screenMounted = true;
    return () => {
      reviewAvailabilityRef.current.screenMounted = false;
    };
  }, []);

  // Reference-stable per estimate so the sheet's reseed guard only fires
  // when a new estimate arrives (not on unrelated re-renders).
  const estimatedMealInput = useMemo(
    () =>
      estimatedMeal
        ? {
            ...mealInputFromEstimate(estimatedMeal),
            // A selected saved meal keeps its stored title — the joined
            // food names are only a fallback for nameless estimates.
            ...(selectedSavedMeal
              ? { name: selectedSavedMeal.name }
              : {}),
          }
        : undefined,
    [estimatedMeal, selectedSavedMeal],
  );

  // Edit flow: the saved meal converts back to an estimate so the sheet
  // seeds exactly like the resolved/quick-pick flows (new identities per
  // meal, so the sheet's reseed guard fires).
  const editingEstimate = useMemo(
    () => (editingMeal ? mealToEstimate(editingMeal) : null),
    [editingMeal],
  );

  const editingMealInput = useMemo(() => {
    if (!editingEstimate || !editingMeal) {
      return undefined;
    }

    const base = mealInputFromEstimate(editingEstimate);

    return {
      ...base,
      // The persisted title is authoritative — the joined food names are
      // only a fallback for nameless records, never a silent rename.
      name: String(editingMeal.name ?? "").trim() || base.name,
    };
  }, [editingEstimate, editingMeal]);

  // One-tap repeat: today's logged meals, deduped by name (latest first).
  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    const recents: Meal[] = [];

    const ordered = [...meals].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );

    for (const meal of ordered) {
      // Defensive: meal names come from unvalidated persisted records —
      // coerce so one malformed record can't crash the diary render.
      const key = String(meal.name ?? "")
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      recents.push(meal);
      if (recents.length >= 5) {
        break;
      }
    }

    return recents;
  }, [meals]);

  // One-tap repeat for individual foods: breakdown foods across today's
  // logged meals, latest first, deduped — stored nutrition (incl. the
  // catalog link for rescaling) rides along on quick-log.
  const recentFoods = useMemo(
    () => recentFoodsFromMeals(meals),
    [meals],
  );

  // S6: one chronological day view — full meal records (S6A cards and
  // editing intact) merged with today's event-timeline items and steps.
  const dayEntries = useMemo(
    () =>
      buildDayTimeline({
        meals,
        timelineItems,
        steps,
        todayKey: getTodayKey(),
      }),
    [meals, timelineItems, steps],
  );

  // S7: today's calorie target, recalculated from configuration +
  // today's activity on every render — never persisted, so a changing
  // target is never stored as a record and history stays untouched.
  const calorieTarget = useMemo(
    () =>
      calculateCalorieTarget({
        maintenanceCalories: targets.maintenanceCalories,
        goal: targets.calorieGoal,
        goalAdjustmentKcal: targets.goalAdjustmentKcal,
        timelineItems,
        todayKey: getTodayKey(),
      }),
    [targets, timelineItems],
  );

  const refreshPendingDescriptions = useCallback(async () => {
    try {
      setPendingDescriptions(await getPendingDescriptionAnalyses());
    } catch {
      // A queue read failure must not hide the normal Nutrition screen.
      setPendingDescriptions([]);
    }
  }, []);

  const handleResolvedFoods = useCallback(
    (
      estimate: MealEstimate,
      pendingId?: string,
      description?: string,
    ) => {
      const plan = planReviewHandoff({
        availability: reviewAvailabilityRef.current,
        handoffInFlight: pendingReviewHandoffRef.current,
        pendingId,
        description,
      });

      if (!plan.open) {
        return;
      }

      setEstimatedMeal(estimate);
      setPendingReviewId(plan.pendingReviewId);
      setPendingReviewDescription(plan.pendingReviewDescription);
      setAddMealOpen(false);
      setMealSheetOpen(true);
    },
    [],
  );

  const runPendingDescriptionRetries = useCallback(async () => {
    // Never replace an already-open review sheet or race its queue
    // acknowledgement with another retry pass.
    if (
      !canPresentPendingDescriptionReview(
        reviewAvailabilityRef.current,
      ) ||
      pendingReviewHandoffRef.current
    ) {
      return;
    }

    try {
      const batch = await retryPendingDescriptions();
      await refreshPendingDescriptions();

      const review = batch.results.find(
        (result) => result.status === "review",
      );

      if (review?.status === "review") {
        // This only hands the estimate to the existing review flow. The
        // pending ID is acknowledged after that sheet has rendered.
        handleResolvedFoods(review.estimate, review.item.id);
      }
    } catch {
      // Pending work remains durable; the next focus/resume trigger retries.
    }
  }, [
    handleResolvedFoods,
    refreshPendingDescriptions,
  ]);

  const handleRetryPending = useCallback(
    async (item: PendingDescriptionAnalysis) => {
      if (
        retryingPendingId !== null ||
        !canPresentPendingDescriptionReview(
          reviewAvailabilityRef.current,
        ) ||
        pendingReviewHandoffRef.current
      ) {
        return;
      }

      setRetryingPendingId(item.id);

      try {
        const result = await retryPendingDescription(item.id);

        if (result.status === "review") {
          handleResolvedFoods(result.estimate, result.item.id);
        } else if (result.status === "pending") {
          showToast(OFFLINE_DESCRIPTION_MESSAGE);
        } else if (result.status === "needs-attention") {
          showToast(result.error.userMessage);
        } else if (result.status === "no-provider") {
          showToast("AI analysis isn't configured yet");
        }
      } catch {
        showToast("Couldn't retry pending analysis");
      } finally {
        setRetryingPendingId(null);
        await refreshPendingDescriptions();
      }
    },
    [
      handleResolvedFoods,
      refreshPendingDescriptions,
      retryingPendingId,
    ],
  );

  // Reload on focus (same pattern as the home tab): a workout or steps
  // logged elsewhere show up as soon as the user returns here.
  useFocusEffect(
    useCallback(() => {
      reviewAvailabilityRef.current.screenFocused = true;
      let cancelled = false;

      async function loadNutrition() {
        try {
          setMeals(await getTodayMeals());
          setTargets(await getNutritionTargets());
          setSavedFoods(await getSavedFoods());
        } catch {
          if (!cancelled) {
            showToast("Couldn't load nutrition");
          }
        }

        // Day-timeline extras are best-effort: meals still display
        // normally when activity/steps fail to load (S6 req 7).
        try {
          const [timeline, todaySteps] = await Promise.all([
            getTimeline(),
            getTodaySteps(),
          ]);
          if (cancelled) {
            return;
          }
          setTimelineItems(timeline);
          setSteps(todaySteps);
        } catch {
          if (!cancelled) {
            setTimelineItems([]);
            setSteps(0);
          }
        }
      }
      loadNutrition();

      return () => {
        reviewAvailabilityRef.current.screenFocused = false;
        cancelled = true;
      };
    }, []),
  );

  // Nutrition focus is a retry trigger in addition to app resume and the
  // optional native/web online event.
  useFocusEffect(
    useCallback(() => {
      void refreshPendingDescriptions();
      void runPendingDescriptionRetries();
    }, [refreshPendingDescriptions, runPendingDescriptionRetries]),
  );

  // AppState/online events use existing platform APIs; no connectivity
  // dependency or polling timer is introduced.
  useEffect(
    () =>
      subscribeToDescriptionAiRetryTriggers(() => {
        void runPendingDescriptionRetries();
      }),
    [runPendingDescriptionRetries],
  );

  // After a review closes, safely continue with the next pending item.
  useEffect(() => {
    if (
      !mealSheetOpen &&
      pendingReviewId === null &&
      pendingReviewDescription === null
    ) {
      void runPendingDescriptionRetries();
    }
  }, [
    mealSheetOpen,
    pendingReviewDescription,
    pendingReviewId,
    runPendingDescriptionRetries,
  ]);

  // MealSheet invokes this only after its review surface has rendered.
  // A retry therefore cannot acknowledge itself while Nutrition is
  // disabled, unmounted, or unable to present the review.
  const handleReviewPresented = useCallback(() => {
    const id = pendingReviewId;
    const description = pendingReviewDescription;

    if (!id && !description) {
      return;
    }

    const acknowledgement = id
      ? acknowledgePendingDescriptionReview(id).then(() => undefined)
      : acknowledgePendingDescriptionReviewByDescription(
          description as string,
        ).then(() => undefined);

    void acknowledgement
      .then(() => {
        setPendingReviewId(null);
        setPendingReviewDescription(null);
        void refreshPendingDescriptions();
      })
      .catch(() => {
        showToast("Couldn't update pending analysis");
      });
  }, [
    pendingReviewDescription,
    pendingReviewId,
    refreshPendingDescriptions,
  ]);

  async function handleSaveMeal(meal: MealInput): Promise<boolean> {
    try {
      const nutrition = toCanonicalMealNutrition(meal);

      if (editingMeal) {
        // Edit flow: update in place, never duplicate.
        const updated = await updateMeal(
          editingMeal.id,
          meal.name,
          nutrition,
          meal.foods,
        );
        if (!updated) {
          showToast("Couldn't save meal");
          return false;
        }
        setMeals((current) =>
          current.map((m) => (m.id === updated.id ? updated : m)),
        );
      } else {
        const saved = await addMeal(
          meal.name,
          nutrition,
          meal.foods,
        );
        setMeals((current) => [...current, saved]);
      }
      setMealSheetOpen(false);
      setEstimatedMeal(null);
      setSelectedSavedMeal(null);
      setEditingMeal(null);
      return true;
    } catch {
      showToast("Couldn't save meal");
      return false;
    }
  }

  /** Instant log from Add Food (DB / saved / recent rows). The sheet stays
   *  open for multi-add; the toast confirms each tap. */
  async function handleQuickLog(meal: MealInput) {
    try {
      const saved = await addMeal(
        meal.name,
        toCanonicalMealNutrition(meal),
        meal.foods,
      );
      setMeals((current) => [...current, saved]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`Logged ${meal.name}`, "success");
    } catch {
      showToast("Couldn't log meal");
    }
  }

  async function handleDeleteMeal(mealId: string) {
    if (deleting) return;
    setDeleting(mealId);
    try {
      await deleteMeal(mealId);
      setMeals((current) =>
        current.filter((m) => m.id !== mealId),
      );
    } catch {
      showToast("Couldn't delete meal");
    } finally {
      setDeleting(null);
    }
  }

  /** A quick-meal catalog pick is a single-food ESTIMATE, not the user's
   *  own verified nutrition — it opens the same review pipeline a saved
   *  MEAL or a resolved description would, rather than quick-logging
   *  directly. Now reached inline from AddMealSheet's own "Quick meals"
   *  section (folded in — no separate picker sheet). */
  function handleQuickPickSelect(meal: MealEstimate) {
    setEstimatedMeal(meal);
    setAddMealOpen(false);
    setMealSheetOpen(true);
  }

  /** S4: a saved MEAL opens the existing review pipeline seeded from its
   *  stored nutrition (fully offline). Logging then creates a
   *  normal Meal with its own timestamp; the template is never mutated. */
  function handleSelectSavedMeal(saved: SavedFood) {
    setSelectedSavedMeal(saved);
    setEstimatedMeal(savedFoodToEstimate(saved));
    setAddMealOpen(false);
    setMealSheetOpen(true);
  }

  /** A template stored from the sheet must show up immediately — the
   *  saved list otherwise only loads on mount. */
  async function handleSavedForReuse() {
    try {
      setSavedFoods(await getSavedFoods());
    } catch {
      // Non-fatal: the template is already stored; the list catches up
      // on the next full load.
    }
  }

  function handleManualMeal() {
    setAddMealOpen(false);
    setMealSheetOpen(true);
  }

  /** S7 targets saved from the sheet — reload so the summary's
   *  calculated target updates immediately. */
  async function handleTargetsSaved() {
    try {
      setTargets(await getNutritionTargets());
    } catch {
      showToast("Couldn't load nutrition targets");
    }
  }

  function handleEditMeal(meal: Meal) {
    setEstimatedMeal(null);
    setEditingMeal(meal);
    setMealSheetOpen(true);
  }

  function handleMealSheetClose() {
    setMealSheetOpen(false);
    setEstimatedMeal(null);
    setSelectedSavedMeal(null);
    setEditingMeal(null);
  }

  if (!enabled.nutrition) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="nutrition"
          title="Nutrition"
          description="Log meals, track macros, and manage your saved foods."
          Icon={Utensils}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NUTRITION</Text>
        <Text style={styles.title}>Nutrition</Text>

        <FadeIn delay={0}>
          <NutritionSummaryCard
            totals={sumMacros(meals)}
            targets={targets}
            calorieTarget={
              calorieTarget.hasMaintenance
                ? {
                    value: calorieTarget.targetKcal,
                    activityKcal: calorieTarget.activityKcal,
                    adjustmentKcal: calorieTarget.adjustmentKcal,
                  }
                : null
            }
          />
        </FadeIn>

        <Pressable
          onPress={() => setTargetsSheetOpen(true)}
          style={styles.targetsRow}
          accessibilityRole="button"
          accessibilityLabel="Edit nutrition targets"
        >
          <Text style={styles.targetsLabel}>
            {calorieTarget.hasMaintenance
              ? `Daily target · ${calorieTarget.targetKcal} kcal`
              : "Nutrition targets"}
          </Text>

          <Text style={styles.targetsEdit}>Adjust</Text>
        </Pressable>

        <PendingDescriptionSection
          items={pendingDescriptions}
          retryingId={retryingPendingId}
          onRetry={(item) => {
            void handleRetryPending(item);
          }}
        />

        {dayEntries.length === 0 ? (
          <EmptyMeals />
        ) : (
          <DayTimeline
            entries={dayEntries}
            deletingId={deleting}
            onDeleteMeal={handleDeleteMeal}
            onEditMeal={handleEditMeal}
            onOpenWorkouts={() => router.navigate("/workouts")}
          />
        )}
      </ScrollView>

      <Pressable
        onPress={() => setAddMealOpen(true)}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Log meal"
      >
        <Plus size={28} color={GymColors.semantic.accent} />
      </Pressable>

      <Modal
        visible={addMealOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddMealOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setAddMealOpen(false)}
          />
          <AddMealSheet
            savedFoods={savedFoods}
            recentMeals={recentMeals}
            recentFoods={recentFoods}
            onQuickLog={handleQuickLog}
            onManual={handleManualMeal}
            onSelectQuickMeal={handleQuickPickSelect}
            onResolved={(estimate, description) =>
              handleResolvedFoods(estimate, undefined, description)
            }
            onPendingChanged={refreshPendingDescriptions}
            onSelectSavedMeal={handleSelectSavedMeal}
            onClose={() => setAddMealOpen(false)}
          />
        </View>
      </Modal>

      <MealSheet
        visible={mealSheetOpen}
        allowSaveForReuse
        onReviewPresented={handleReviewPresented}
        onSavedForReuse={handleSavedForReuse}
        editMode={editingMeal !== null}
        initialMeal={estimatedMealInput ?? editingMealInput}
        initialFoods={estimatedMeal?.foods ?? editingEstimate?.foods}
        savedFoods={savedFoods}
        onSave={handleSaveMeal}
        onClose={handleMealSheetClose}
      />

      <NutritionTargetsSheet
        visible={targetsSheetOpen}
        onClose={() => setTargetsSheetOpen(false)}
        onSaved={handleTargetsSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    // Clears the floating + action (bottom 24 + 56 size + 24 breathing).
    paddingBottom: 104,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  targetsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.four,
  },

  targetsLabel: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  targetsEdit: {
    color: GymColors.semantic.accent,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  fab: {
    position: "absolute",
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
});