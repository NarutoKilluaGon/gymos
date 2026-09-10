import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { SavedFood } from "@/storage/repositories/saved-foods";

type SavedFoodsSheetProps = {
  foods: SavedFood[];
  adding: boolean;
  onSelect: (food: SavedFood) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function SavedFoodsSheet({
  foods,
  adding,
  onSelect,
  onDelete,
  onClose,
}: SavedFoodsSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved Foods</Text>

          <Text style={styles.subtitle}>
            Tap to log a saved food quickly.
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

      {foods.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No saved foods yet. Save one when logging a meal.
          </Text>
        </View>
      ) : (
        <View style={styles.options}>
          {foods.map((food) => (
            <View key={food.id} style={styles.option}>
              <Pressable
                disabled={adding}
                onPress={() => onSelect(food)}
                style={styles.optionMain}
                accessibilityRole="button"
                accessibilityLabel={`Log ${food.name}`}
              >
                <Text style={styles.optionText}>{food.name}</Text>

                <Text style={styles.optionCalories}>
                  {food.calories !== undefined
                    ? `${food.calories} kcal`
                    : "—"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onDelete(food.id)}
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

  empty: {
    paddingVertical: Spacing.five,
    alignItems: "center",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
  },

  options: {
    gap: Spacing.two,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingLeft: Spacing.three,
  },

  optionMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },

  optionText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  optionCalories: {
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
