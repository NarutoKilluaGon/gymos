import { StyleSheet, Text, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";

/**
 * Empty day state: title + guidance only. Logging always starts from
 * the screen's floating Log meal action, so this view intentionally
 * carries no second button into the same sheet.
 */
export function EmptyMeals() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No meals logged yet</Text>

      <Text style={styles.subtitle}>
        Add your first meal to start tracking today.
      </Text>
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
});
