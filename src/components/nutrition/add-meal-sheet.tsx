import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  foodEntryToEstimate,
  searchFoods,
  type FoodEntry,
} from "@/services/food-db";
import {
  canStartAnalysis,
  mealInputFromEstimate,
  mealInputFromRecentMeal,
  RESOLUTION_STAGES,
  resolveMealDescriptionWithProviderStaged,
  searchQuickMeals,
  type MealEstimate,
  type ResolutionProgress,
} from "@/services/meal-estimator";
import {
  enqueueDescriptionAiNetworkFailure,
  OFFLINE_DESCRIPTION_MESSAGE,
} from "@/services/description-ai-queue";
import { NutritionProcessingProgress } from "@/components/nutrition/nutrition-processing-progress";
import type { MealInput } from "@/components/quick-add/meal-sheet";
import {
  isSavedMeal,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { Meal, MealFood } from "@/types/gymos";
import { pickMicronutrients } from "@/types/gymos";
import { showToast } from "@/utils/toast";

export type AddMealSheetProps = {
  savedFoods: SavedFood[];
  recentMeals: Meal[];
  /** Individual foods from recently logged meals (latest first,
   *  deduped) for one-tap repeat logging with stored nutrition. */
  recentFoods: MealFood[];
  onQuickLog: (meal: MealInput) => void;
  onManual: () => void;
  /** Description-first entry: receives the resolved estimate from the
   *  optional description provider plus local Food DB precedence. When no
   *  provider is configured, the existing local/manual flow is used. */
  onResolved: (
    estimate: MealEstimate,
    description?: string,
  ) => void;
  /** A curated Quick Meal pick is a single-food ESTIMATE, not the user's
   *  own verified nutrition — it opens the same review pipeline a saved
   *  MEAL does, rather than quick-logging directly (see the section
   *  ordering note below for why). */
  onSelectQuickMeal: (meal: MealEstimate) => void;
  /** Refresh the Nutrition screen after a network failure is queued. */
  onPendingChanged?: () => void | Promise<void>;
  /** S4: a saved MEAL opens the review pipeline (stored nutrition). */
  onSelectSavedMeal: (saved: SavedFood) => void;
  onClose: () => void;
};

const MAX_SEARCH_RESULTS = 15;
/** Cap on the always-visible Quick Meals list before the user types a
 *  search — the full catalog (searchQuickMeals("")) returns every
 *  entry, which would crowd out the user's own saved/recent foods on a
 *  screen that opens with nothing typed yet. Typing narrows to matches
 *  only, so the cap never hides a result the user asked for. */
const FEATURED_QUICK_MEALS = 6;

/** "135 kcal · 20g protein · 7g carbs · 3g fat", skipping unknowns. */
function formatMacros(macros: {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): string {
  const parts: string[] = [];

  parts.push(
    macros.calories !== undefined ? `${macros.calories} kcal` : "—",
  );

  if (macros.protein !== undefined) {
    parts.push(`${macros.protein}g protein`);
  }
  if (macros.carbs) {
    parts.push(`${macros.carbs}g carbs`);
  }
  if (macros.fat) {
    parts.push(`${macros.fat}g fat`);
  }

  return parts.join(" · ");
}

/** One-tap row: name + macros + a "+" action that logs IMMEDIATELY, no
 *  review. Reserved for nutrition the app already trusts: a Food DB
 *  catalog match, the user's own saved food, or something they've
 *  logged before. */
function LogRow({
  name,
  meta,
  actionLabel,
  onLog,
}: {
  name: string;
  meta: string;
  actionLabel: string;
  onLog: () => void;
}) {
  return (
    <View style={styles.logRow}>
      <View style={styles.logTextBlock}>
        <Text style={styles.logName} numberOfLines={1}>
          {name}
        </Text>

        <Text style={styles.logMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <Pressable
        onPress={onLog}
        style={styles.logButton}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.logButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

/** Same shell as LogRow, but the whole row opens REVIEW instead of
 *  logging instantly — a chevron replaces the "+" so the two are never
 *  visually confused. Reserved for nutrition that's still an estimate
 *  (a curated Quick Meal's macros) rather than a known/verified value,
 *  the same distinction the app already makes for AI estimates. */
function ReviewRow({
  name,
  meta,
  actionLabel,
  onOpen,
}: {
  name: string;
  meta: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={styles.reviewRow}
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
    >
      <View style={styles.logTextBlock}>
        <Text style={styles.logName} numberOfLines={1}>
          {name}
        </Text>

        <Text style={styles.logMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/**
 * Description-first logging entry point: one natural-language
 * description drives the optional description provider plus local
 * Food DB precedence into the existing MealSheet review.
 *
 * Everything else the user might want lives in ONE shared search box
 * below it, split into two kinds of result:
 *   - LogRow (a "+" button, logs immediately): Food DB matches, the
 *     user's own saved foods, recent foods, recent meals — nutrition
 *     the app already trusts.
 *   - ReviewRow (a chevron, opens MealSheet review first): the curated
 *     Quick Meals catalog and saved MEALS — an estimate or a multi-food
 *     combination worth a final look before it's logged.
 * Manual entry sits as a quiet footnote link. There is exactly one
 * search box and one saved-foods list in the whole app; the Hub's
 * Saved Foods screen manages the underlying list (add/delete) but
 * never duplicates this one for logging.
 */
export function AddMealSheet({
  savedFoods,
  recentMeals,
  recentFoods,
  onQuickLog,
  onManual,
  onResolved,
  onSelectQuickMeal,
  onPendingChanged,
  onSelectSavedMeal,
  onClose,
}: AddMealSheetProps) {
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [resolving, setResolving] = useState(false);
  // Determinate progress for the resolve; each stage advances only
  // after its real work completes (parse → each food → totals).
  const [progress, setProgress] =
    useState<ResolutionProgress | null>(null);

  // Shared busy-guard: while a resolve is in flight the input and
  // button are locked, so a double-tap can never submit twice.
  const canAnalyze = canStartAnalysis(resolving, description);

  async function handleAnalyze() {
    const text = description.trim();

    if (!canStartAnalysis(resolving, text)) {
      return;
    }

    setResolving(true);

    try {
      const result = await resolveMealDescriptionWithProviderStaged(
        text,
        (update) => setProgress(update),
        // Macrotask yields so each completed stage paints; local work
        // itself is instant — nothing artificial is awaited.
        () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
        // The user's own saved foods remain the fallback when no
        // description provider is configured.
        savedFoods,
      );

      if (result.status === "empty") {
        showToast("Describe your meal");
        return;
      }

      if (result.status === "failed") {
        if (result.error.code === "network") {
          try {
            await enqueueDescriptionAiNetworkFailure(
              text,
              result.error,
            );
            showToast(OFFLINE_DESCRIPTION_MESSAGE);
            void onPendingChanged?.();
            onClose();
          } catch {
            showToast("Couldn't save pending analysis");
          }
        } else {
          // HTTP/provider and invalid-response failures are not offline
          // queue candidates. Keep them explicit without endless retries.
          showToast(result.error.userMessage);
        }
        return;
      }

      onResolved(result.estimate, text);

    } finally {
      setProgress(null);
      setResolving(false);
    }
  }

  const dbResults = useMemo(
    () =>
      query.trim()
        ? searchFoods(query).slice(0, MAX_SEARCH_RESULTS)
        : [],
    [query],
  );

  const quickMealResults = useMemo(() => {
    const results = searchQuickMeals(query);
    // Unfiltered (empty query) results are the ENTIRE catalog — capped
    // here so it doesn't crowd out saved/recent foods on first open. A
    // real search is never truncated: every match the user typed for
    // stays visible.
    return query.trim()
      ? results
      : results.slice(0, FEATURED_QUICK_MEALS);
  }, [query]);

  function logFoodEntry(entry: FoodEntry) {
    const estimate = foodEntryToEstimate(entry);

    onQuickLog({
      ...mealInputFromEstimate(estimate),
      // Keep the user-facing search label while retaining the complete
      // catalog row and all 16 nutrients in the canonical MealInput.
      name: `${entry.name} (${entry.amount} ${entry.unit})`,
    });
  }

  function logRecentFood(food: MealFood) {
    // One tap re-logs a single food with its previous nutrition
    // reference intact (macros, micros, and catalog link for rescaling).
    onQuickLog({
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      ...pickMicronutrients(food),
      foods: [food],
    });
  }

  /** "150 g · 90 kcal · 5g protein" — portion first when known. */
  function formatRecentFood(food: MealFood): string {
    const portion = [food.amount, food.unit]
      .filter(
        (part) => part !== undefined && part !== "",
      )
      .join(" ");
    const macros = formatMacros(food);

    return portion ? `${portion} · ${macros}` : macros;
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>Log meal</Text>

          <Text style={styles.subtitle}>
            Describe it, search, or pick a shortcut.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add food"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.describeBlock}>
        <SectionLabel>What did you eat?</SectionLabel>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. 10 eggs omelette with 200g cooked rice and 150g curd"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.description}
          multiline
          editable={!resolving}
          accessibilityLabel="Meal description"
        />
         <Pressable
          onPress={handleAnalyze}
          disabled={!canAnalyze}
          style={[
            styles.analyzeButton,
            !canAnalyze && styles.analyzeButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Analyze description"
        >
          {resolving && progress ? (
            <View style={styles.analyzeInner}>
              <NutritionProcessingProgress
                label={progress.label}
                detail={progress.detail}
                current={progress.stageIndex + 1}
                total={RESOLUTION_STAGES.length}
              />
              <Text style={styles.analyzeText}>
                {progress.label} — {progress.detail}
              </Text>
            </View>
          ) : (
            <Text style={styles.analyzeText}>Analyze</Text>
          )}
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Or search foods…"
        placeholderTextColor={GymColors.text.tertiary}
        style={styles.search}
        autoCorrect={false}
        accessibilityLabel="Search the food database"
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {query.trim() !== "" && (
          <View style={styles.section}>
            <SectionLabel>Food database</SectionLabel>

            {dbResults.length === 0 ? (
              <Text style={styles.emptyText}>
                No matches — try fewer words.
              </Text>
            ) : (
              dbResults.map((entry) => (
                <LogRow
                  key={entry.id}
                  name={entry.name}
                  meta={`${entry.amount} ${entry.unit} · ${formatMacros(entry)}`}
                  actionLabel={`Log ${entry.name}`}
                  onLog={() => logFoodEntry(entry)}
                />
              ))
            )}
          </View>
        )}

        {quickMealResults.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Quick meals</SectionLabel>

            {quickMealResults.map((meal) => {
              const input = mealInputFromEstimate(meal);

              return (
                <ReviewRow
                  key={input.name}
                  name={input.name}
                  meta={formatMacros(input)}
                  actionLabel={`Review ${input.name}`}
                  onOpen={() => onSelectQuickMeal(meal)}
                />
              );
            })}
          </View>
        )}

        {savedFoods.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Saved foods & meals</SectionLabel>

            {savedFoods.map((food) =>
              // Saved meals open review from stored nutrition (offline,
              // S4); individual foods quick-log their stored values
              // directly, never through the Food DB.
              isSavedMeal(food) ? (
                <ReviewRow
                  key={food.id}
                  name={food.name}
                  meta={formatMacros(food)}
                  actionLabel={`Review ${food.name}`}
                  onOpen={() => onSelectSavedMeal(food)}
                />
              ) : (
                <LogRow
                  key={food.id}
                  name={food.name}
                  meta={formatMacros(food)}
                  actionLabel={`Log ${food.name}`}
                  onLog={() =>
                    onQuickLog({
                      name: food.name,
                      calories: food.calories,
                      protein: food.protein,
                      carbs: food.carbs,
                      fat: food.fat,
                      ...pickMicronutrients(food),
                    })
                  }
                />
              ),
            )}
          </View>
        )}

        {recentFoods.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Recent foods</SectionLabel>

            {recentFoods.map((food, index) => (
              <LogRow
                key={`${food.name}-${index}`}
                name={food.name}
                meta={formatRecentFood(food)}
                actionLabel={`Log ${food.name} again`}
                onLog={() => logRecentFood(food)}
              />
            ))}
          </View>
        )}

        {recentMeals.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Recent meals</SectionLabel>

            {recentMeals.map((meal) => (
              <LogRow
                key={meal.id}
                name={meal.name}
                meta={formatMacros(meal)}
                actionLabel={`Log ${meal.name} again`}
                onLog={() =>
                  onQuickLog(mealInputFromRecentMeal(meal))
                }
              />
            ))}
          </View>
        )}

      </ScrollView>

      <View style={styles.footnoteRow}>
        <Pressable
          onPress={onManual}
          style={styles.footnoteLink}
          accessibilityRole="button"
          accessibilityLabel="Build a meal manually"
        >
          <Text style={styles.footnoteText}>Build manually</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    maxHeight: "85%",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  headerTitleBlock: {
    flex: 1,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
    lineHeight: 18,
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: GymColors.text.secondary,
    fontSize: 30,
    fontWeight: "300",
  },

  search: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  describeBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },

  description: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 88,
    textAlignVertical: "top",
  },

  analyzeButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  analyzeButtonDisabled: {
    opacity: 0.5,
  },

  analyzeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  analyzeText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  footnoteRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },

  footnoteLink: {
    paddingVertical: Spacing.one,
  },

  footnoteText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  scroll: {
  },

  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },

  section: {
    gap: Spacing.two,
  },

  sectionLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  emptyText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.body,
  },

  logRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingLeft: Spacing.three,
  },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three,
  },

  logTextBlock: {
    flex: 1,
    paddingVertical: Spacing.two,
  },

  logName: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  logMeta: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  logButton: {
    width: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },

  logButtonText: {
    color: GymColors.text.primary,
    fontSize: 24,
    fontWeight: "600",
  },

  chevron: {
    color: GymColors.text.tertiary,
    fontSize: 22,
    fontWeight: "300",
  },
});
