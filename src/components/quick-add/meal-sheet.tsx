import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  getFoodEntry,
  isSameUnit,
} from "@/services/food-db";
import {
  applyFoodRowPatch,
  canSaveReusableNutrition,
  canStartAnalysis,
  computeMealTotals,
  establishRowBase,
  foodRowToMealFood,
  mealInputForSave,
  rescaleFoodRow,
  toCanonicalMealNutrition,
  resolveFoodForMeal,
  toFoodRow,
  type FoodRow,
} from "@/services/meal-estimator";
import { NutritionProcessingProgress } from "@/components/nutrition/nutrition-processing-progress";
import {
  addSavedFood,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import {
  MICRONUTRIENT_KEYS,
  pickMicronutrients,
  type MealFood,
  type Micronutrients,
  type MicronutrientKey,
  type NutritionSource,
} from "@/types/gymos";
import { showToast } from "@/utils/toast";

export type MealInput = {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Optional per-food breakdown for the save path (legacy persisted
   *  additionals, if any, ride along inside each MealFood untouched). */
  foods?: MealFood[];
} & Micronutrients;

/** One food item within a review sheet: locally resolved from the Food
 *  DB, reopened from a saved breakdown, or flagged `unresolved` when no
 *  confident catalog match existed (all fields editable text in the
 *  sheet's rows; unresolved rows need manual macros before logging). */
export type EstimatedFood = {
  name: string;
  estimatedAmount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Offline food-database entry id when nutrition came from the catalog
   *  — lets later amount edits rescale the row (S6A). */
  entryId?: string;
  /** True when no confident catalog match existed: macros are zero as
   *  "unknown", never as a measurement — the sheet shows "Nutrition
   *  needed" until the user types them manually. Never persisted. */
  unresolved?: boolean;
  /** Transient review provenance; not written to the persisted MealFood. */
  nutritionSource?: NutritionSource;
} & Micronutrients;

const FOOD_MACROS = [
  "calories",
  "protein",
  "carbs",
  "fat",
] as const;

const MICRO_LABELS: Record<MicronutrientKey, string> = {
  fiber: "Fiber",
  sodium: "Sodium",
  potassium: "Potassium",
  calcium: "Calcium",
  iron: "Iron",
  magnesium: "Magnesium",
  zinc: "Zinc",
  vitaminA: "Vitamin A",
  vitaminC: "Vitamin C",
  vitaminD: "Vitamin D",
  vitaminB12: "Vitamin B12",
  folate: "Folate",
};

/**
 * True when a row still needs manual nutrition: flagged unresolved by
 * local resolution AND every macro still blank-or-zero. Typing any macro
 * clears the need visibly with no extra state — and clearing every macro
 * re-flags it, so zeros can never slip through as real measurements.
 */
function needsNutrition(row: FoodRow): boolean {
  if (row.unresolved !== true) {
    return false;
  }

  return FOOD_MACROS.every((macro) => {
    const value = Number(row[macro].trim());

    return !(Number.isFinite(value) && value > 0);
  });
}

/** Compact read-only macro line for collapsed rows: kcal plus the
 *  P/C/F split. Display only — editing happens in the quantity fields
 *  or the expanded form. */
function formatRowMacros(row: FoodRow): { kcal: string; rest: string } {
  const num = (value: string): number => {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) && parsed > 0
      ? Math.round(parsed * 100) / 100
      : 0;
  };

  return {
    kcal: `${num(row.calories)} kcal`,
    rest: `P ${num(row.protein)}g · C ${num(row.carbs)}g · F ${num(
      row.fat,
    )}g`,
  };
}

/**
 * Progressive disclosure for the 12 micronutrients: read-only values on
 * catalog rows (the DB portion is authoritative), editable inputs
 * elsewhere (blank clears the claim). Keeps every row clean while the
 * full 16-nutrient model survives underneath.
 */
function MicroGrid({
  row,
  onMicro,
}: {
  row: FoodRow;
  onMicro: ((key: MicronutrientKey, text: string) => void) | null;
}) {
  return (
    <View style={styles.microGrid}>
      {MICRONUTRIENT_KEYS.map((key) => {
        const value = row.micros[key];

        return (
          <View key={key} style={styles.microCell}>
            <Text style={styles.microLabel}>
              {MICRO_LABELS[key]}
            </Text>

            {onMicro ? (
              <TextInput
                value={
                  value !== undefined ? String(value) : ""
                }
                onChangeText={(text) =>
                  onMicro(key, text)
                }
                placeholder="—"
                placeholderTextColor={
                  GymColors.text.tertiary
                }
                keyboardType="decimal-pad"
                style={styles.microInput}
                accessibilityLabel={MICRO_LABELS[key]}
              />
            ) : (
              <Text style={styles.microValue}>
                {value !== undefined
                  ? String(
                      Math.round(value * 100) / 100,
                    )
                  : "—"}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

type MealSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (
    meal: MealInput,
  ) => void | boolean | Promise<void | boolean>;
  /** Called once after this sheet has actually rendered a queued
   * description review. The parent uses this for acknowledgement. */
  onReviewPresented?: () => void;
  /** Explicit "Save for reuse" action (S4) — off by default. */
  allowSaveForReuse?: boolean;
  /** Called after a template is stored so the parent can refresh its list. */
  onSavedForReuse?: () => void;
  /** Edit mode: title/save copy reflect updating instead of logging. */
  editMode?: boolean;
  initialMeal?: MealInput;
  initialFoods?: EstimatedFood[];
  /** The user's saved foods for resolution priority #2 (Food DB first,
   *  then saved numbers, then manual entry). Passed from the Nutrition
   *  screen, which already holds the list. */
  savedFoods?: SavedFood[];
};

export function MealSheet({
  visible,
  onClose,
  onSave,
  onReviewPresented,
  allowSaveForReuse = false,
  onSavedForReuse,
  editMode = false,
  initialMeal,
  initialFoods,
  savedFoods,
}: MealSheetProps) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [lastInitial, setLastInitial] = useState<
    MealInput | undefined
  >();
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [lastInitialFoods, setLastInitialFoods] = useState<
    EstimatedFood[] | undefined
  >();
  /** Flat meal-level micros are a fallback for sparse legacy rows. */
  const [initialMicronutrients, setInitialMicronutrients] =
    useState<Micronutrients>({});
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const reviewPresentedRef = useRef(false);
  // "+ Add food" resolver form: name + optional amount/unit, resolved
  // locally against the Food DB (unresolved rows need manual macros).
  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addUnit, setAddUnit] = useState("");
  // Determinate progress for the add (finding → totals); each step only
  // advances after its real work completes.
  const [addProgress, setAddProgress] = useState<{
    label: string;
    detail: string;
    current: number;
    total: number;
  } | null>(null);

  // The parent passes this only for a queued review. It fires from the
  // rendered MealSheet, not merely from a state transition on the screen.
  useEffect(() => {
    if (!visible) {
      reviewPresentedRef.current = false;
      return;
    }

    if (onReviewPresented && !reviewPresentedRef.current) {
      reviewPresentedRef.current = true;
      onReviewPresented();
    }
  }, [onReviewPresented, visible]);

  // Seed fields when an estimated meal arrives (e.g. after local resolution).
  if (visible && initialMeal && initialMeal !== lastInitial) {
    setLastInitial(initialMeal);
    setName(initialMeal.name ?? "");
    setCalories(
      initialMeal.calories !== undefined
        ? String(initialMeal.calories)
        : "",
    );
    setProtein(
      initialMeal.protein !== undefined
        ? String(initialMeal.protein)
        : "",
    );
    setCarbs(
      initialMeal.carbs !== undefined
        ? String(initialMeal.carbs)
        : "",
    );
    setFat(
      initialMeal.fat !== undefined
        ? String(initialMeal.fat)
        : "",
    );
    setInitialMicronutrients(pickMicronutrients(initialMeal));
  }

  // Seed the detected-food list when a new estimate arrives.
  if (visible && initialFoods && initialFoods !== lastInitialFoods) {
    setLastInitialFoods(initialFoods);
    setFoods(initialFoods.map(toFoodRow));
  }

  function parseOptional(value: string): number | undefined {
    if (!value.trim()) {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : undefined;
  }

  // S6A: meal totals are always derived from the current food list —
  // recomputed on every render, so any add/remove/amount/nutrient edit
  // updates them immediately with no manual recalculation. Totals-only
  // meals (no named rows) keep their hand-editable fields.
  const mealFoods = foods
    .map(foodRowToMealFood)
    .filter((food): food is MealFood => food !== null);
  const derivedTotals =
    mealFoods.length > 0 ? computeMealTotals(mealFoods) : null;
  const canResolveFood = canStartAnalysis(resolving, addName);

  /** The four displayed totals: derived from the foods when rows exist,
   *  otherwise whatever the user typed (manual totals-only entry). */
  function displayedTotals(): {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } {
    if (derivedTotals) {
      return {
        calories: derivedTotals.calories,
        protein: derivedTotals.protein,
        carbs: derivedTotals.carbs,
        fat: derivedTotals.fat,
      };
    }

    return {
      calories: parseOptional(calories),
      protein: parseOptional(protein),
      carbs: parseOptional(carbs),
      fat: parseOptional(fat),
    };
  }

  function currentMealInput(): MealInput {
    return mealInputForSave({
      name,
      displayedTotals: displayedTotals(),
      derivedTotals,
      foods: mealFoods,
      fallbackMicronutrients: initialMicronutrients,
    });
  }

  function updateFood(
    key: string,
    patch: Partial<FoodRow>,
  ) {
    setFoods((rows) =>
      rows.map((row) =>
        row.key === key ? applyFoodRowPatch(row, patch) : row,
      ),
    );
  }

  function removeFood(key: string) {
    setFoods((rows) =>
      rows.filter((row) => row.key !== key),
    );
  }

  /** Amount/unit edits rescale instantly (catalog portion or stable
   *  base) so totals follow with no button, no spinner, no network. */
  function updateFoodPortion(
    key: string,
    patch: Partial<Pick<FoodRow, "amount" | "unit">>,
  ) {
    setFoods((rows) =>
      rows.map((row) =>
        row.key === key
          ? rescaleFoodRow({ ...row, ...patch })
          : row,
      ),
    );
  }

  /** Micro edit on one row: blank clears the claim, valid non-negative
   *  numbers set it, anything else is ignored (never wipes while
   *  typing). Non-catalog rows refresh their scaling base like macros. */
  function updateMicro(
    key: string,
    microKey: MicronutrientKey,
    text: string,
  ) {
    setFoods((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return row;
        }

        const trimmed = text.trim();
        const next = { ...row.micros };

        if (trimmed === "") {
          delete next[microKey];
        } else {
          const parsed = Number(trimmed);

          if (!Number.isFinite(parsed) || parsed < 0) {
            return row;
          }

          next[microKey] = parsed;
        }

        const updated = { ...row, micros: next };

        return !updated.entryId
          ? establishRowBase(updated)
          : updated;
      }),
    );
  }

  /** Expanded "Nutrition details" rows, by row key. Collapsed is the
   *  default: resolved rows read as a plate, not a form. */
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  function toggleExpanded(key: string) {
    setExpandedKeys((keys) =>
      keys.includes(key)
        ? keys.filter((candidate) => candidate !== key)
        : [...keys, key],
    );
  }

  /**
   * Adopt the catalog unit for a row whose unit can't scale: reset to
   * the entry's own portion (the only amount known to match the unit)
   * and rescale — never reinterpret the stale amount in the new unit.
   */
  function useSuggestedUnit(key: string) {
    setFoods((rows) =>
      rows.map((row) => {
        if (row.key !== key || !row.entryId) {
          return row;
        }

        const entry = getFoodEntry(row.entryId);

        if (!entry) {
          return row;
        }

        return rescaleFoodRow({
          ...row,
          amount: String(entry.amount),
          unit: entry.unit,
          unresolved: false,
        });
      }),
    );
  }

  function closeAddForm() {
    setAddName("");
    setAddAmount("");
    setAddUnit("");
    setAddFoodOpen(false);
  }

  /** "+ Add food": resolve the entry locally against the Food DB —
   *  exact match scales catalog nutrition in, anything else arrives as
   *  an explicitly-unresolved row for manual macros. Determinate
   *  two-stage progress (finding → totals) replaces the old indefinite
   *  busy state; local work is instant, so stages paint and complete. */
  async function handleResolveFood() {
    const description = addName.trim();

    if (!canResolveFood) {
      return;
    }

    setResolving(true);

    const tick = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      const amount = parseOptional(addAmount);
      setAddProgress({
        label: "Finding nutrition",
        detail: "1 of 1",
        current: 1,
        total: 2,
      });
      await tick();

      const result = resolveFoodForMeal(
        {
          description,
          ...(amount !== undefined ? { amount } : {}),
          ...(addUnit.trim() ? { unit: addUnit.trim() } : {}),
        },
        savedFoods,
      );

      if (result.status === "none") {
        showToast("Couldn't find that food");
        return;
      }

      setAddProgress({
        label: "Calculating totals",
        detail:
          result.status === "resolved"
            ? "Nutrition found"
            : "Nutrition needed",
        current: 2,
        total: 2,
      });
      await tick();

      setFoods((rows) => [
        ...rows,
        ...result.foods.map(toFoodRow),
      ]);
      closeAddForm();
    } finally {
      setAddProgress(null);
      setResolving(false);
    }
  }

  async function handleSave() {
    if (savingRef.current) {
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    // Unresolved rows carry zero macros as "unknown" — never log them as
    // if they were measured. The user types macros manually first.
    const needy = foods.filter(needsNutrition);

    if (needy.length > 0) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      showToast(
        `Add nutrition for "${needy[0].name.trim() || "food"}" before logging`,
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );

      // Keep the form and food rows intact until the parent confirms the
      // write. `false` is the explicit failure result; legacy void-returning
      // callbacks remain successful for compatibility.
      const result = await onSave(currentMealInput());

      if (result === false) {
        return;
      }

      setName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setFoods([]);
      setLastInitial(undefined);
      setLastInitialFoods(undefined);
      setInitialMicronutrients({});
      setExpandedKeys([]);
      closeAddForm();
      setAddProgress(null);
    } catch {
      showToast("Couldn't save meal");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /** Explicit saved-meal action (S4): stores a reusable template —
   *  stored totals (all 16 nutrients when a breakdown exists) plus the
   *  complete food breakdown — WITHOUT logging. Logging stays the
   *  primary button, so a logged meal never silently becomes reusable. */
  async function handleSaveForReuse() {
    if (savingRef.current) {
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    // Reuse follows the same review gate as logging. An unresolved row
    // must be completed before its zero values can become a template.
    const needy = foods.filter(needsNutrition);
    const reusableInput = currentMealInput();
    const reusableNutrition =
      toCanonicalMealNutrition(reusableInput);

    // A blank/all-zero reusable record is incomplete, not a valid saved
    // meal. Existing positive totals-only saved foods remain supported.
    if (!canSaveReusableNutrition(reusableNutrition, needy.length > 0)) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      showToast(
        needy.length > 0
          ? `Add nutrition for "${needy[0].name.trim() || "food"}" before saving`
          : "Add nutrition before saving for reuse",
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      await addSavedFood(
        trimmed,
        reusableNutrition,
        reusableInput.foods,
      );
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      showToast("Saved for reuse", "success");
      onSavedForReuse?.();
    } catch {
      showToast("Couldn't save for reuse");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleClose() {
    if (savingRef.current) {
      return;
    }

    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFoods([]);
    setLastInitial(undefined);
    setLastInitialFoods(undefined);
    setInitialMicronutrients({});
    setExpandedKeys([]);
    closeAddForm();
    setAddProgress(null);
    setResolving(false);
    onClose();
  }

  // Recalculation status, derived from the actual rows every render:
  // totals are instant (no spinner), and the count keeps the feedback
  // honest about what was summed.
  const unresolvedCount = foods.filter(needsNutrition).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          disabled={saving}
        />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? "Edit meal" : "Log meal"}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close meal"
              onPress={handleClose}
              disabled={saving}
              style={styles.closeButton}
            >
              <X
                size={22}
                color={GymColors.text.secondary}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.fields}
          >
            <View style={styles.foodsSection}>
              <Text style={styles.label}>Foods</Text>

              {foods.map((row) => {
                const needy = needsNutrition(row);
                const expanded = expandedKeys.includes(row.key);
                // Collapsed rows read as a plate (name + quantity +
                // macro line); the full form shows for rows that need
                // nutrition or are explicitly expanded.
                const showForm = needy || expanded;
                const entry =
                  row.entryId !== undefined
                    ? getFoodEntry(row.entryId)
                    : undefined;
                const unitSupported =
                  row.entryId === undefined ||
                  row.unit.trim() === "" ||
                  (entry !== undefined &&
                    isSameUnit(row.unit, entry.unit));
                const summary = formatRowMacros(row);

                return (
                <View
                  key={row.key}
                  style={styles.foodCard}
                >
                  <View style={styles.foodHeader}>
                    {showForm ? (
                      <TextInput
                        value={row.name}
                        onChangeText={(text) =>
                          updateFood(row.key, {
                            name: text,
                          })
                        }
                        placeholder="Food name"
                        placeholderTextColor={
                          GymColors.text.tertiary
                        }
                        style={styles.foodName}
                        accessibilityLabel="Food name"
                      />
                    ) : (
                      <Text
                        style={styles.foodNameText}
                        numberOfLines={1}
                      >
                        {row.name.trim() || "Unnamed food"}
                      </Text>
                    )}

                    <Pressable
                      onPress={() =>
                        removeFood(row.key)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${
                        row.name || "food"
                      }`}
                      style={
                        styles.foodRemoveButton
                      }
                    >
                      <X
                        size={18}
                        color={
                          GymColors.text.secondary
                        }
                      />
                    </Pressable>
                  </View>

                  {needy && (
                    <View style={styles.unresolvedBadge}>
                      <Text style={styles.unresolvedText}>
                        Nutrition needed — enter macros below
                      </Text>
                    </View>
                  )}

                  {!unitSupported && entry && (
                    <View style={styles.unitWarn}>
                      <Text style={styles.unitWarnText}>
                        {`Unit not supported — values are per ${entry.unit}.`}
                      </Text>

                      <Pressable
                        onPress={() =>
                          useSuggestedUnit(row.key)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${entry.unit} instead`}
                      >
                        <Text style={styles.unitWarnAction}>
                          {`Use ${entry.unit}`}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.foodDetailRow}>
                    <TextInput
                      value={row.amount}
                      onChangeText={(text) =>
                        updateFoodPortion(row.key, {
                          amount: text,
                        })
                      }
                      placeholder="Amount"
                      placeholderTextColor={
                        GymColors.text.tertiary
                      }
                      keyboardType="decimal-pad"
                      style={styles.foodDetailInput}
                      accessibilityLabel="Estimated amount"
                    />

                    <TextInput
                      value={row.unit}
                      onChangeText={(text) =>
                        updateFoodPortion(row.key, {
                          unit: text,
                        })
                      }
                      placeholder="Unit"
                      placeholderTextColor={
                        GymColors.text.tertiary
                      }
                      style={styles.foodDetailInput}
                      accessibilityLabel="Unit"
                    />
                  </View>

                  {!showForm && (
                    <Text style={styles.foodMacroSummary}>
                      <Text style={styles.foodMacroSummaryKcal}>
                        {summary.kcal}
                      </Text>
                      {` · ${summary.rest}`}
                    </Text>
                  )}

                  {showForm && (
                    <View style={styles.foodMacroRow}>
                      {FOOD_MACROS.map((macro) => (
                        <View
                          key={macro}
                          style={styles.foodMacroBox}
                        >
                          <Text
                            style={styles.foodMacroLabel}
                          >
                            {macro === "calories"
                              ? "kcal"
                              : macro
                                  .charAt(0)
                                  .toUpperCase() +
                                macro.slice(1)}
                          </Text>

                          <TextInput
                            value={row[macro]}
                            onChangeText={(text) =>
                              updateFood(row.key, {
                                [macro]: text,
                              } as Partial<FoodRow>)
                            }
                            placeholder="0"
                            placeholderTextColor={
                              GymColors.text.tertiary
                            }
                            keyboardType="number-pad"
                            style={
                              styles.foodMacroInput
                            }
                            accessibilityLabel={macro}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  <Pressable
                    onPress={() =>
                      toggleExpanded(row.key)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      expanded
                        ? `Hide nutrition details for ${
                            row.name || "food"
                          }`
                        : `Show nutrition details for ${
                            row.name || "food"
                          }`
                    }
                  >
                    <Text style={styles.detailsToggle}>
                      {expanded
                        ? "Hide details"
                        : "Nutrition details"}
                    </Text>
                  </Pressable>

                  {expanded &&
                    (row.entryId === undefined ||
                    Object.keys(row.micros).length > 0 ? (
                      <MicroGrid
                        row={row}
                        onMicro={
                          row.entryId === undefined
                            ? (microKey, text) =>
                                updateMicro(
                                  row.key,
                                  microKey,
                                  text,
                                )
                            : null
                        }
                      />
                    ) : null)}
                </View>
                );
              })}

              <View style={styles.foodActionRow}>
                <Pressable
                  onPress={() =>
                    addFoodOpen
                      ? closeAddForm()
                      : setAddFoodOpen(true)
                  }
                  style={styles.foodActionButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    addFoodOpen
                      ? "Close the add food form"
                      : "Add food"
                  }
                >
                  <Text style={styles.foodActionText}>
                    {addFoodOpen ? "Close" : "+ Add food"}
                  </Text>
                </Pressable>
              </View>

              {/* Entries resolve locally with determinate progress —
                  exact Food DB matches scale catalog nutrition in, the
                  rest arrive flagged for manual macros. */}
              {addFoodOpen && (
                <View style={styles.addForm}>
                  <TextInput
                    value={addName}
                    onChangeText={setAddName}
                    placeholder="Food (e.g. 150g curd)"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    style={styles.addFormInput}
                    editable={!resolving}
                    accessibilityLabel="Food to add"
                  />

                  <View style={styles.addFormRow}>
                    <TextInput
                      value={addAmount}
                      onChangeText={setAddAmount}
                      placeholder="Amt"
                      placeholderTextColor={
                        GymColors.text.tertiary
                      }
                      keyboardType="decimal-pad"
                      style={styles.addFormAmount}
                      editable={!resolving}
                      accessibilityLabel="Amount for the new food"
                    />

                    <TextInput
                      value={addUnit}
                      onChangeText={setAddUnit}
                      placeholder="Unit"
                      placeholderTextColor={
                        GymColors.text.tertiary
                      }
                      style={styles.addFormUnit}
                      editable={!resolving}
                      accessibilityLabel="Unit for the new food"
                    />

                    <Pressable
                      onPress={handleResolveFood}
                      disabled={!canResolveFood}
                      style={[
                        styles.addFormButton,
                        !canResolveFood &&
                          styles.addFormButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Add food with nutrition"
                    >
                      <Text
                        style={styles.addFormButtonText}
                      >
                        Add
                      </Text>
                    </Pressable>
                  </View>

                  {resolving && addProgress && (
                    <NutritionProcessingProgress
                      label={addProgress.label}
                      detail={addProgress.detail}
                      current={addProgress.current}
                      total={addProgress.total}
                      status="active"
                    />
                  )}
                </View>
              )}
            </View>

            <Text style={styles.label}>Meal</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Chicken rice"
              placeholderTextColor={
                GymColors.text.tertiary
              }
              style={styles.input}
              autoFocus
            />

            <View style={styles.macroGrid}>
              <View style={styles.macroField}>
                <Text style={styles.label}>
                  Calories
                </Text>

                <View style={styles.macroInputRow}>
                  <TextInput
                    value={
                      derivedTotals
                        ? String(derivedTotals.calories)
                        : calories
                    }
                    onChangeText={setCalories}
                    placeholder="580"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    editable={derivedTotals === null}
                    style={styles.macroInput}
                  />

                  <Text style={styles.macroUnit}>
                    kcal
                  </Text>
                </View>
              </View>

              <View style={styles.macroField}>
                <Text style={styles.label}>
                  Protein
                </Text>

                <View style={styles.macroInputRow}>
                  <TextInput
                    value={
                      derivedTotals
                        ? String(derivedTotals.protein)
                        : protein
                    }
                    onChangeText={setProtein}
                    placeholder="40"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    editable={derivedTotals === null}
                    style={styles.macroInput}
                  />

                  <Text style={styles.macroUnit}>
                    g
                  </Text>
                </View>
              </View>

              <View style={styles.macroField}>
                <Text style={styles.label}>
                  Carbs
                </Text>

                <View style={styles.macroInputRow}>
                  <TextInput
                    value={
                      derivedTotals
                        ? String(derivedTotals.carbs)
                        : carbs
                    }
                    onChangeText={setCarbs}
                    placeholder="65"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    editable={derivedTotals === null}
                    style={styles.macroInput}
                  />

                  <Text style={styles.macroUnit}>
                    g
                  </Text>
                </View>
              </View>

              <View style={styles.macroField}>
                <Text style={styles.label}>Fat</Text>

                <View style={styles.macroInputRow}>
                  <TextInput
                    value={
                      derivedTotals
                        ? String(derivedTotals.fat)
                        : fat
                    }
                    onChangeText={setFat}
                    placeholder="12"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    editable={derivedTotals === null}
                    style={styles.macroInput}
                  />

                  <Text style={styles.macroUnit}>
                    g
                  </Text>
                </View>
              </View>
            </View>

            {derivedTotals && (
              <Text style={styles.derivedHint}>
                {`Totals auto-summed from ${mealFoods.length} food${
                  mealFoods.length === 1 ? "" : "s"
                }.`}
              </Text>
            )}

            {unresolvedCount > 0 && (
              <Text style={styles.unresolvedHint}>
                {unresolvedCount === 1
                  ? "1 food still needs nutrition."
                  : `${unresolvedCount} foods still need nutrition.`}
              </Text>
            )}
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            accessibilityLabel={editMode ? "Save meal changes" : "Log meal"}
          >
            <Text style={styles.saveText}>
              {saving
                ? "Saving…"
                : editMode
                  ? "Save changes"
                  : "Log meal"}
            </Text>
          </Pressable>

          {allowSaveForReuse && (
            <Pressable
              onPress={handleSaveForReuse}
              disabled={saving}
              style={[
                styles.reuseButton,
                saving && styles.reuseButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              accessibilityLabel="Save this meal for reuse"
            >
              <Text style={styles.reuseText}>
                {saving ? "Saving…" : "Save for reuse"}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },

  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxHeight: "85%",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  fields: {
    flexGrow: 0,
  },

  label: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginBottom: Spacing.one,
  },

  input: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.three,
  },

  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },

  macroField: {
    width: "47%",
  },

  macroInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },

  macroInput: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: 20,
    paddingVertical: Spacing.three,
  },

  macroUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  reuseButton: {
    marginTop: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  reuseButtonDisabled: {
    opacity: 0.5,
  },

  reuseText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  saveButton: {
    marginTop: Spacing.three,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  foodsSection: {
    marginBottom: Spacing.three,
  },

  foodCard: {
    flexDirection: "column",
    gap: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  foodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    width: "100%",
  },

  foodName: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingVertical: Spacing.one,
  },

  foodNameText: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    paddingVertical: Spacing.one,
  },

  foodRemoveButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  unresolvedBadge: {
    width: "100%",
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  unresolvedText: {
    color: GymColors.semantic.warning,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  foodDetailRow: {
    flexDirection: "row",
    gap: Spacing.two,
    width: "100%",
  },

  foodDetailInput: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  foodMacroRow: {
    flexDirection: "row",
    gap: Spacing.two,
    width: "100%",
  },

  foodMacroBox: {
    flex: 1,
  },

  foodMacroLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.half,
  },

  foodMacroInput: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  foodMacroSummary: {
    width: "100%",
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  foodMacroSummaryKcal: {
    color: GymColors.text.primary,
    fontWeight: "700",
  },

  detailsToggle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
    paddingVertical: Spacing.one,
  },

  microGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    width: "100%",
  },

  microCell: {
    width: "31%",
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  microLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  microInput: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingVertical: Spacing.one,
  },

  microValue: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingVertical: Spacing.one,
  },

  unitWarn: {
    width: "100%",
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },

  unitWarnText: {
    color: GymColors.semantic.warning,
    fontSize: Typography.caption,
  },

  unitWarnAction: {
    color: GymColors.semantic.accent,
    fontSize: Typography.caption,
    fontWeight: "700",
  },

  foodActionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  foodActionButton: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  foodActionText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  derivedHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.two,
  },

  unresolvedHint: {
    color: GymColors.semantic.warning,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  addForm: {
    gap: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },

  addFormInput: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  addFormRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },

  addFormAmount: {
    width: 72,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    textAlign: "center",
  },

  addFormUnit: {
    width: 72,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    textAlign: "center",
  },

  addFormButton: {
    flex: 1,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  addFormButtonDisabled: {
    opacity: 0.5,
  },

  addFormButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.caption,
    fontWeight: "700",
  },
});