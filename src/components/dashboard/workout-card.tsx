import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import type { PlanDay } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";

type WorkoutCardProps = {
  /** Today's workout, or null if none started yet. */
  workout?: WorkoutSession | null;
  /** Today's day from Forge's active plan, shown when no workout is active. */
  plannedDay?: PlanDay | null;
};

function exerciseCount(day: PlanDay): string {
  const count = day.exercises.length;

  return `${count} ${count === 1 ? "exercise" : "exercises"}`;
}

function describeWorkout(workout: WorkoutSession): {
  title: string;
  message: string;
} {
  const totalSets = workout.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0,
  );

  const cardioCount = workout.cardio?.length ?? 0;

  if (workout.exercises.length === 0 && cardioCount === 0) {
    return {
      title: workout.name,
      message: "Workout started — add your first exercise.",
    };
  }

  const parts: string[] = [];

  if (workout.exercises.length > 0) {
    parts.push(
      `${workout.exercises.length} ${
        workout.exercises.length === 1 ? "exercise" : "exercises"
      }, ${totalSets} ${totalSets === 1 ? "set" : "sets"} logged`,
    );
  }

  if (cardioCount > 0) {
    parts.push(`${cardioCount} cardio`);
  }

  return {
    title: workout.name,
    message: parts.join(" · "),
  };
}

export function WorkoutCard({
  workout,
  plannedDay,
}: WorkoutCardProps) {
  const active = workout ?? null;

  const display = active
    ? describeWorkout(active)
    : plannedDay
      ? {
          title: plannedDay.name,
          message: `${exerciseCount(plannedDay)} ready — start from Workouts.`,
        }
      : {
          title: "No workout yet",
          message:
            "Start today's session to build momentum.",
        };

  const card = (
    <GymCard style={styles.card}>
      <Text style={styles.eyebrow}>
        {active ? "TODAY'S WORKOUT" : "WORKOUT SCHEDULED"}
      </Text>

      <Text style={styles.title}>{display.title}</Text>

      <Text style={styles.message}>
        {display.message}
      </Text>

    </GymCard>
  );

  if (active) {
    return card;
  }

  // Idle card doubles as a CTA into the Workouts tab.
  return (
    <Pressable
      onPress={() => router.navigate("/workouts")}
      accessibilityRole="button"
      accessibilityLabel="Open workouts"
    >
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },

  message: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginTop: Spacing.one,
    lineHeight: 22,
  },
});