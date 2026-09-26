import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import { mealFoodsLine } from "@/services/meal-estimator";
import type { Meal } from "@/types/gymos";

type MealCardProps = {
  meal: Meal;
  deleting?: boolean;
  onDelete: () => void;
};

/** Rounded display calories ("1,120") without relying on Intl. */
function formatKcal(value: number): string {
  return String(Math.round(value)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

/**
 * Compact diary card: name, optional foods breakdown, calories, and macros.
 * No timestamp — the timeline owns the time marker (meal.timestamp stays
 * the persisted source of truth).
 */
export function MealCard({ meal, deleting, onDelete }: MealCardProps) {
  // Secondary line only when it adds info beyond the title (e.g. a manual
  // "Breakfast" with distinct foods — never a repeat of joined food names).
  const foodsLine = mealFoodsLine(meal.name, meal.foods);

  const macros: string[] = [];

  if (meal.protein !== undefined) {
    macros.push(`P ${Math.round(meal.protein)}g`);
  }
  if (meal.carbs !== undefined) {
    macros.push(`C ${Math.round(meal.carbs)}g`);
  }
  if (meal.fat !== undefined) {
    macros.push(`F ${Math.round(meal.fat)}g`);
  }

  return (
    <GymCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{meal.name}</Text>

          {foodsLine ? (
            <Text style={styles.foods} numberOfLines={2}>
              {foodsLine}
            </Text>
          ) : null}
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

      {meal.calories !== undefined && (
        <Text style={styles.calories}>
          {formatKcal(meal.calories)} kcal
        </Text>
      )}

      {macros.length > 0 && (
        <View style={styles.macroRow}>
          {macros.map((macro) => (
            <Text key={macro} style={styles.macroText}>
              {macro}
            </Text>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },

  name: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  foods: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
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

  calories: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "700",
  },

  macroRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },

  macroText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },
});
