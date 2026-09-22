import { Trash2, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { WorkoutExercise } from "@/types/gymos";

type ExerciseCardProps = {
  exercise: WorkoutExercise;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
};

export function ExerciseCard({
  exercise,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: ExerciseCardProps) {
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

        <View style={styles.actions}>
          <Pressable
            onPress={onRemoveExercise}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name} from workout`}
          >
            <Trash2 size={18} color={GymColors.text.secondary} />
          </Pressable>

          <Pressable
            onPress={onAddSet}
            style={styles.setButton}
            accessibilityRole="button"
            accessibilityLabel={`Add set to ${exercise.name}`}
          >
            <Text style={styles.setButtonText}>+ Set</Text>
          </Pressable>
        </View>
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

              <Pressable
                onPress={() => onRemoveSet(set.id)}
                style={styles.removeSetButton}
                accessibilityRole="button"
                accessibilityLabel={`Delete set ${index + 1}`}
              >
                <X size={16} color={GymColors.text.tertiary} />
              </Pressable>

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

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
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

  removeSetButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  completed: {
    color: GymColors.semantic.success,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});