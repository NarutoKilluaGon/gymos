import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  EXERCISES,
  MUSCLE_GROUPS,
} from "@/data/exercises";

type ExercisePickerSheetProps = {
  adding: boolean;
  onSelect: (exerciseId: string, name: string) => void;
  onClose: () => void;
};

export function ExercisePickerSheet({
  adding,
  onSelect,
  onClose,
}: ExercisePickerSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Add Exercise</Text>

          <Text style={styles.subtitle}>Choose an exercise to add.</Text>
        </View>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close exercise picker"
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {MUSCLE_GROUPS.map((group) => {
          const exercises = EXERCISES.filter(
            (e) => e.muscleGroup === group,
          );

          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupLabel}>{group}</Text>

              <View style={styles.options}>
                {exercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    disabled={adding}
                    onPress={() =>
                      onSelect(exercise.id, exercise.name)
                    }
                    style={styles.option}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${exercise.name}`}
                  >
                    <Text style={styles.optionText}>
                      {exercise.name}
                    </Text>

                    <Text style={styles.arrow}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: GymColors.text.secondary,
    fontSize: 30,
    fontWeight: "300",
  },

  scroll: {
    maxHeight: 480,
  },

  group: {
    marginBottom: Spacing.three,
  },

  groupLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  options: {
    gap: Spacing.two,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  optionText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  arrow: {
    color: GymColors.text.tertiary,
    fontSize: 24,
  },
});
