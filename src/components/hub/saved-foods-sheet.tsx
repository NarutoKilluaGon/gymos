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

export function SavedFoodsSheet({ onClose }: SavedFoodsSheetProps) {
  const [foods, setFoods] = useState<SavedFood[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getSavedFoods().then(setFoods).catch(() => setFoods([]));
  }, []);

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
      const parsedCalories = Number(calories);
      const caloriesValue =
        Number.isFinite(parsedCalories) && parsedCalories > 0
          ? parsedCalories
          : undefined;

      const food = await addSavedFood(trimmed, {
        calories: caloriesValue,
      });

      if (food) {
        setFoods((current) => [...current, food]);
        setName("");
        setCalories("");
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

      <View style={styles.addRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Food name"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.nameInput}
        />

        <TextInput
          value={calories}
          onChangeText={setCalories}
          placeholder="kcal"
          placeholderTextColor={GymColors.text.tertiary}
          keyboardType="number-pad"
          style={styles.caloriesInput}
        />

        <Pressable
          onPress={handleAdd}
          disabled={adding}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Save food"
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {foods.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No saved foods yet. Add one above.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {foods.map((food) => (
            <View key={food.id} style={styles.foodRow}>
              <View style={styles.foodMain}>
                <Text style={styles.foodName}>{food.name}</Text>

                <Text style={styles.foodCalories}>
                  {food.calories !== undefined
                    ? `${food.calories} kcal`
                    : "—"}
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

  addRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  nameInput: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  caloriesInput: {
    width: 80,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  addButton: {
    width: 48,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: GymColors.background.primary,
    fontSize: 22,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: Spacing.five,
    alignItems: "center",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },

  foodName: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  foodCalories: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
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