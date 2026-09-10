import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import type { WorkoutSession } from "@/types/gymos";

type ActiveWorkoutCardProps = {
  workout: WorkoutSession;
};

export function ActiveWorkoutCard({
  workout,
}: ActiveWorkoutCardProps) {
  const cardioCount = workout.cardio?.length ?? 0;

  const subtitle =
    `${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"}` +
    (cardioCount > 0 ? ` · ${cardioCount} cardio` : "");

  return (
    <GymCard style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />

        <Text style={styles.statusText}>Workout active</Text>
      </View>

      <Text style={styles.title}>{workout.name}</Text>

      <Text style={styles.subtitle}>{subtitle}</Text>
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GymColors.semantic.success,
  },

  statusText: {
    color: GymColors.semantic.success,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },
});
