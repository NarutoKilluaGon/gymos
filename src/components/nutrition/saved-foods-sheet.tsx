import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import { showToast } from "@/utils/toast";

type SavedFoodsSheetProps = {
  onClose: () => void;
};

/**
 * Manage (view + delete) the same saved-foods list AddMealSheet logs
 * from — this screen never duplicates that logging surface, it only
 * maintains the underlying list.
 *
 * The manual-add form below captures all four macros, matching exactly
 * what MealSheet's "Save as reusable" already stores when you save a
 * food from a real logged/reviewed meal. That's the richer, recommended
 * way to build this list — most saved foods should come from there. This
 * form exists for the cold-start case (setting up a regular before
 * you've ever logged it), and deliberately stores the same shape rather
 * than a calories-only shortcut: a food added here should never show up
 * looking macro-incomplete next to one saved from review.
 */
export function SavedFoodsSheet({ onClose }: SavedFoodsSheetProps) {
  const [foods, setFoods] = useState<SavedFood[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getSavedFoods().then(setFoods).catch(() => setFoods([]));
  }, []);

  function parsedMacro(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  async function handleAdd() {
    if (adding) return;
    const trimmed = name.trim();

    if (!trimmed) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    setAdding(true);
    try {
      const food = await addSavedFood(trimmed, {
        calories: parsedMacro(calories),
        protein: parsedMacro(protein),
        carbs: parsedMacro(carbs),
        fat: parsedMacro(fat),
      });

      if (food) {
        setFoods((current) => [...current, food]);
        setName("");
        setCalories("");
        setProtein("");
        setCarbs("");
        setFat("");
      }
    } catch {
      showToast("Couldn't save food");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavedFood(id);
      setFoods((current) => current.filter((f) => f.id !== id));
    } catch {
      showToast("Couldn't delete food");
    }
  }

  /** "580 kcal · 40g protein · 65g carbs · 12g fat", skipping unknowns —
   *  same rule AddMealSheet's own macro line uses, so a food looks
   *  identical wherever it's shown. */
  function formatMacros(food: SavedFood): string {
    if (food.calories === undefined) {
      return "—";
    }

    const parts = [`${food.calories} kcal`];

    if (food.protein !== undefined) parts.push(`${food.protein}g protein`);
    if (food.carbs) parts.push(`${food.carbs}g carbs`);
    if (food.fat) parts.push(`${food.fat}g fat`);

    return parts.join(" · ");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved Foods</Text>

          <Text style={styles.subtitle}>
            Foods you log often, kept here.
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close saved foods"
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.addForm}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Food name"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.nameInput}
        />

        <View style={styles.macroRow}>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            placeholder="kcal"
            placeholderTextColor={GymColors.text.tertiary}
            keyboardType="number-pad"
            style={styles.macroInput}
            accessibilityLabel="Calories"
          />

          <TextInput
            value={protein}
            onChangeText={setProtein}
            placeholder="protein g"
            placeholderTextColor={GymColors.text.tertiary}
            keyboardType="number-pad"
            style={styles.macroInput}
            accessibilityLabel="Protein in grams"
          />

          <TextInput
            value={carbs}
            onChangeText={setCarbs}
            placeholder="carbs g"
            placeholderTextColor={GymColors.text.tertiary}
            keyboardType="number-pad"
            style={styles.macroInput}
            accessibilityLabel="Carbohydrates in grams"
          />

          <TextInput
            value={fat}
            onChangeText={setFat}
            placeholder="fat g"
            placeholderTextColor={GymColors.text.tertiary}
            keyboardType="number-pad"
            style={styles.macroInput}
            accessibilityLabel="Fat in grams"
          />
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={adding}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Save food"
        >
          <Text style={styles.addButtonText}>Save food</Text>
        </Pressable>
      </View>

      {foods.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No saved foods yet. Add one above, or save one straight
            from a logged meal.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {foods.map((food) => (
            <View key={food.id} style={styles.foodRow}>
              <View style={styles.foodMain}>
                <Text style={styles.foodName} numberOfLines={1}>
                  {food.name}
                </Text>

                <Text style={styles.foodMacros} numberOfLines={1}>
                  {formatMacros(food)}
                </Text>
              </View>

              <Pressable
                onPress={() => handleDelete(food.id)}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${food.name}`}
              >
                <Text style={styles.deleteText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxHeight: "75%",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
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

  addForm: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  nameInput: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  macroRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  macroInput: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
  },

  addButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  addButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  empty: {
    paddingVertical: Spacing.five,
    alignItems: "center",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
  },

  list: {
    gap: Spacing.two,
  },

  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },

  foodMain: {
    flex: 1,
    paddingVertical: Spacing.three,
  },

  foodName: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  foodMacros: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  deleteButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    color: GymColors.text.secondary,
    fontSize: 24,
    fontWeight: "300",
  },
});
