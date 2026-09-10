import { Pressable, StyleSheet, Text } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";

type EmptyExercisesProps = {
  onAddExercise: () => void;
};

export function EmptyExercises({ onAddExercise }: EmptyExercisesProps) {
  return (
    <GymCard style={styles.card}>
      <Text style={styles.title}>No exercises yet</Text>

      <Text style={styles.subtitle}>
        Add your first exercise to start logging sets.
      </Text>

      <Pressable
        onPress={onAddExercise}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Add exercise"
      >
        <Text style={styles.buttonText}>Add Exercise</Text>
      </Pressable>
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
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
    lineHeight: 22,
  },

  button: {
    marginTop: Spacing.two,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  buttonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
