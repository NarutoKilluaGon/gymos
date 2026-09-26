import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Spacing, Typography } from "@/constants/theme";
import { MealCard } from "@/components/nutrition/meal-card";
import type { Meal } from "@/types/gymos";

/** "8:30 AM" from the persisted meal timestamp. "" when unparseable. */
export function formatMealTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type MealTimelineProps = {
  /** Chronological ascending — new meals land at their timestamp position. */
  meals: Meal[];
  deletingId: string | null;
  onDeleteMeal: (id: string) => void;
  onEditMeal: (meal: Meal) => void;
};

/**
 * One continuous vertical diary timeline: a single line runs through every
 * meal, each with its persisted timestamp on the rail and the card beside
 * it. First/last line segments hide so the line starts and ends at a dot.
 * Tapping a card reopens it for editing; delete stays on the card itself.
 */
export function MealTimeline({
  meals,
  deletingId,
  onDeleteMeal,
  onEditMeal,
}: MealTimelineProps) {
  return (
    <View style={styles.list}>
      {meals.map((meal, index) => (
        <View key={meal.id} style={styles.row}>
          <View style={styles.timeWrap}>
            <Text style={styles.time}>
              {formatMealTime(meal.timestamp)}
            </Text>
          </View>

          <View style={styles.rail}>
            <View
              style={[styles.line, index === 0 && styles.lineHidden]}
            />

            <View style={styles.dot} />

            <View
              style={[
                styles.line,
                index === meals.length - 1 && styles.lineHidden,
              ]}
            />
          </View>

          <Pressable
            style={styles.cardWrap}
            onPress={() => onEditMeal(meal)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${meal.name}`}
          >
            <MealCard
              meal={meal}
              deleting={deletingId === meal.id}
              onDelete={() => onDeleteMeal(meal.id)}
            />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const RAIL_WIDTH = 16;
const DOT_SIZE = 12;

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },

  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  timeWrap: {
    width: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  time: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "right",
  },

  rail: {
    width: RAIL_WIDTH,
    alignItems: "center",
  },

  line: {
    flex: 1,
    width: 2,
    backgroundColor: GymColors.background.surface,
  },

  lineHidden: {
    opacity: 0,
  },

  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: GymColors.semantic.accent,
  },

  cardWrap: {
    flex: 1,
  },
});
