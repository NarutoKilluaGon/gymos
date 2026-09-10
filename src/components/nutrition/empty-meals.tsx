import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";

type EmptyMealsProps = {
  onAddMeal: () => void;
};

export function EmptyMeals({ onAddMeal }: EmptyMealsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No meals logged yet</Text>

      <Text style={styles.subtitle}>
        Add your first meal to start tracking today.
      </Text>

      <Pressable
        onPress={onAddMeal}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Add a meal"
      >
        <Text style={styles.buttonText}>Add a meal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.large,
    gap: Spacing.two,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "600",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
    marginBottom: Spacing.one,
  },

  button: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  buttonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});
