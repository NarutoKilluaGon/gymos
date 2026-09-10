import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { WorkoutExercise } from "@/types/gymos";

type ExerciseCardProps = {
  exercise: WorkoutExercise;
  onAddSet: () => void;
};

export function ExerciseCard({ exercise, onAddSet }: ExerciseCardProps) {
  return (
    <GymCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{exercise.name}</Text>

          <Text style={styles.meta}>
            {exercise.sets.length}{" "}
            {exercise.sets.length === 1 ? "set" : "sets"}
          </Text>
        </View>

        <Pressable
          onPress={onAddSet}
          style={styles.setButton}
          accessibilityRole="button"
          accessibilityLabel={`Add set to ${exercise.name}`}
        >
          <Text style={styles.setButtonText}>+ Set</Text>
        </Pressable>
      </View>

      {exercise.sets.length > 0 && (
        <View style={styles.setList}>
          {exercise.sets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>{index + 1}</Text>

              <Text style={styles.setValue}>
                {set.weight} {set.unit}
              </Text>

              <Text style={styles.setValue}>{set.reps} reps</Text>

              <Text style={styles.completed}>✓</Text>
            </View>
          ))}
        </View>
      )}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
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

  meta: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  setButton: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  setButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  setList: {
    gap: Spacing.one,
  },

  setRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.primary,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  setNumber: {
    width: 28,
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  setValue: {
    flex: 1,
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  completed: {
    color: GymColors.semantic.success,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});
