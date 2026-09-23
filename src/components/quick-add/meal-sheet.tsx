import { useState } from "react";
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
import { addSavedFood } from "@/storage/repositories/saved-foods";
import { createId } from "@/utils/id";
import { showToast } from "@/utils/toast";

export type MealInput = {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

/** A single detected/estimated food item within a photo-scan result. */
export type EstimatedFood = {
  name: string;
  estimatedAmount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Editable review row for one detected food (all fields are text). */
type FoodRow = {
  key: string;
  name: string;
  amount: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

const FOOD_MACROS = [
  "calories",
  "protein",
  "carbs",
  "fat",
] as const;

function toFoodRow(food: EstimatedFood): FoodRow {
  return {
    key: createId(),
    name: food.name,
    amount: String(food.estimatedAmount),
    unit: food.unit,
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
  };
}

type MealSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (meal: MealInput) => void;
  allowFavorite?: boolean;
  initialMeal?: MealInput;
  initialFoods?: EstimatedFood[];
};

export function MealSheet({
  visible,
  onClose,
  onSave,
  allowFavorite = false,
  initialMeal,
  initialFoods,
}: MealSheetProps) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveAsFavorite, setSaveAsFavorite] =
    useState(false);
  const [lastInitial, setLastInitial] = useState<
    MealInput | undefined
  >();
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [lastInitialFoods, setLastInitialFoods] = useState<
    EstimatedFood[] | undefined
  >();

  // Seed fields when an estimated meal arrives (e.g. after a photo scan).
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

  /** Food-row numbers feed recalculation only; blank/invalid count as 0. */
  function parseFoodNumber(value: string): number {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : 0;
  }

  function updateFood(
    key: string,
    patch: Partial<FoodRow>,
  ) {
    setFoods((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    );
  }

  function removeFood(key: string) {
    setFoods((rows) =>
      rows.filter((row) => row.key !== key),
    );
  }

  function addFood() {
    setFoods((rows) => [
      ...rows,
      {
        key: createId(),
        name: "",
        amount: "",
        unit: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      },
    ]);
  }

  // Totals stay editable; this re-derives them from the displayed foods.
  function recalcTotalsFromFoods() {
    const sum = (pick: (row: FoodRow) => string) =>
      Math.round(
        foods.reduce(
          (total, row) =>
            total + parseFoodNumber(pick(row)),
          0,
        ) * 100,
      ) / 100;

    setCalories(String(sum((row) => row.calories)));
    setProtein(String(sum((row) => row.protein)));
    setCarbs(String(sum((row) => row.carbs)));
    setFat(String(sum((row) => row.fat)));
  }

  async function handleSave() {
    const trimmed = name.trim();

    if (!trimmed) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    const macros = {
      calories: parseOptional(calories),
      protein: parseOptional(protein),
      carbs: parseOptional(carbs),
      fat: parseOptional(fat),
    };

    if (saveAsFavorite) {
      try {
        await addSavedFood(trimmed, macros);
      } catch {
        // Failing the favorite save shouldn't block logging the meal.
        showToast("Couldn't save to favorites");
      }
    }

    onSave({
      name: trimmed,
      ...macros,
    });

    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSaveAsFavorite(false);
    setFoods([]);
    setLastInitialFoods(undefined);
  }

  function handleClose() {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSaveAsFavorite(false);
    setFoods([]);
    setLastInitial(undefined);
    setLastInitialFoods(undefined);
    onClose();
  }

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
        />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Log meal</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close meal"
              onPress={handleClose}
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
            {lastInitialFoods !== undefined && (
              <View style={styles.foodsSection}>
                <Text style={styles.label}>
                  Detected foods
                </Text>

                {foods.map((row) => (
                  <View
                    key={row.key}
                    style={styles.foodCard}
                  >
                    <View style={styles.foodHeader}>
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

                    <View style={styles.foodDetailRow}>
                      <TextInput
                        value={row.amount}
                        onChangeText={(text) =>
                          updateFood(row.key, {
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
                          updateFood(row.key, {
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
                  </View>
                ))}

                <View style={styles.foodActionRow}>
                  <Pressable
                    onPress={addFood}
                    style={styles.foodActionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Add food"
                  >
                    <Text style={styles.foodActionText}>
                      + Add food
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={recalcTotalsFromFoods}
                    style={styles.foodActionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Recalculate totals from foods"
                  >
                    <Text style={styles.foodActionText}>
                      Recalc totals
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

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
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="580"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
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
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="40"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
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
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="65"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
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
                    value={fat}
                    onChangeText={setFat}
                    placeholder="12"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    style={styles.macroInput}
                  />

                  <Text style={styles.macroUnit}>
                    g
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {allowFavorite && (
            <Pressable
              onPress={() => setSaveAsFavorite((v) => !v)}
              style={styles.favoriteRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: saveAsFavorite }}
              accessibilityLabel="Save as favorite for quick logging"
            >
              <View
                style={[
                  styles.checkbox,
                  saveAsFavorite && styles.checkboxChecked,
                ]}
              >
                {saveAsFavorite && (
                  <Text style={styles.checkboxMark}>✓</Text>
                )}
              </View>

              <Text style={styles.favoriteText}>
                Save as favorite for quick logging
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save meal"
          >
            <Text style={styles.saveText}>
              Save meal
            </Text>
          </Pressable>
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

  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: GymColors.text.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxChecked: {
    backgroundColor: GymColors.semantic.accent,
    borderColor: GymColors.semantic.accent,
  },

  checkboxMark: {
    color: GymColors.background.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  favoriteText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  saveButton: {
    marginTop: Spacing.three,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
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

  foodRemoveButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  foodDetailRow: {
    flexDirection: "row",
    gap: Spacing.two,
    width: "48%",
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
    width: "48%",
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
});