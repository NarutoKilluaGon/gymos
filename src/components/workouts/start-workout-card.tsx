import { Pressable, StyleSheet, Text } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";

type StartWorkoutCardProps = {
  starting: boolean;
  onStart: () => void;
};

export function StartWorkoutCard({
  starting,
  onStart,
}: StartWorkoutCardProps) {
  return (
    <GymCard style={styles.card}>
      <Text style={styles.title}>Ready to train?</Text>

      <Text style={styles.subtitle}>
        Pick a routine to preload your exercises and start the session.
      </Text>

      <Pressable
        onPress={onStart}
        disabled={starting}
        style={[
          styles.button,
          starting && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start workout"
      >
        <Text style={styles.buttonText}>
          {starting ? "Starting..." : "Start Workout"}
        </Text>
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
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
  },

  button: {
    marginTop: Spacing.two,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});
