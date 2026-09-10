import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { Meal } from "@/types/gymos";

type MealCardProps = {
  meal: Meal;
  deleting?: boolean;
  onDelete: () => void;
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MealCard({ meal, deleting, onDelete }: MealCardProps) {
  const macros = [
    meal.calories !== undefined
      ? `${meal.calories} kcal`
      : null,
    meal.protein !== undefined
      ? `${meal.protein}g protein`
      : null,
    meal.carbs !== undefined
      ? `${meal.carbs}g carbs`
      : null,
    meal.fat !== undefined ? `${meal.fat}g fat` : null,
  ].filter((m): m is string => m !== null);

  return (
    <GymCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{meal.name}</Text>

          <Text style={styles.time}>{formatTime(meal.timestamp)}</Text>
        </View>

        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${meal.name}`}
        >
          <Text style={styles.deleteText}>{deleting ? "…" : "×"}</Text>
        </Pressable>
      </View>

      {macros.length > 0 && (
        <View style={styles.macroRow}>
          {macros.map((macro) => (
            <View key={macro} style={styles.macroChip}>
              <Text style={styles.macroChipText}>{macro}</Text>
            </View>
          ))}
        </View>
      )}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },

  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  titleBlock: {
    flex: 1,
  },

  name: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  time: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    color: GymColors.text.secondary,
    fontSize: 24,
    fontWeight: "300",
  },

  macroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  macroChip: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },

  macroChipText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },
});
