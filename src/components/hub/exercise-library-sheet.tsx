import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  EXERCISES,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from "@/data/exercises";

type ExerciseLibrarySheetProps = {
  onClose: () => void;
};

type Filter = "All" | MuscleGroup;

const FILTERS: Filter[] = ["All", ...MUSCLE_GROUPS];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: GymColors.semantic.success,
  intermediate: GymColors.semantic.warning,
  advanced: GymColors.semantic.error,
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  "ez-bar": "EZ-Bar",
  "smith-machine": "Smith Machine",
};

export function ExerciseLibrarySheet({
  onClose,
}: ExerciseLibrarySheetProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleGroups =
    filter === "All" ? MUSCLE_GROUPS : [filter];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Exercise Library</Text>

          <Text style={styles.subtitle}>
            24 exercises with technique guides
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close exercise library"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((item) => {
          const selected = item === filter;

          return (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.chip,
                selected && styles.chipSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filter by ${item}`}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {visibleGroups.map((group) => {
          const exercises = EXERCISES.filter(
            (e) => e.muscleGroup === group,
          );

          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupLabel}>
                {group.toUpperCase()}
              </Text>

              <View style={styles.list}>
                {exercises.map((exercise) => {
                  const isExpanded =
                    expanded === exercise.id;

                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() =>
                        setExpanded(
                          isExpanded ? null : exercise.id,
                        )
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      style={styles.row}
                    >
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowText}>
                          {exercise.name}
                        </Text>

                        <View style={styles.tags}>
                          <View
                            style={[
                              styles.difficultyBadge,
                              {
                                backgroundColor:
                                  DIFFICULTY_COLORS[exercise.difficulty],
                              },
                            ]}
                          >
                            <Text style={styles.difficultyText}>
                              {exercise.difficulty.charAt(0).toUpperCase() +
                                exercise.difficulty.slice(1)}
                            </Text>
                          </View>

                          <View style={styles.equipmentBadge}>
                            <Text style={styles.equipmentText}>
                              {EQUIPMENT_LABELS[exercise.equipment]}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.typeText}>
                        {exercise.type === "compound"
                          ? "Compound"
                          : "Isolation"}
                      </Text>

                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          <Text style={styles.muscleLabel}>
                            Primary:{" "}
                            {exercise.primaryMuscles.join(", ")}
                          </Text>

                          {exercise.secondaryMuscles &&
                            exercise.secondaryMuscles.length >
                              0 && (
                              <Text style={styles.muscleLabel}>
                                Secondary:{" "}
                                {exercise.secondaryMuscles.join(
                                  ", ",
                                )}
                              </Text>
                            )}

                          {exercise.instructions && (
                            <Text style={styles.instructions}>
                              {exercise.instructions}
                            </Text>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
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
    height: "80%",
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

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.card,
  },

  chipSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  chipText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  chipTextSelected: {
    color: GymColors.background.primary,
  },

  scroll: {
    flex: 1,
  },

  group: {
    marginBottom: Spacing.four,
  },

  groupLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  list: {
    gap: Spacing.two,
  },

  row: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  tags: {
    flexDirection: "row",
    gap: Spacing.one,
  },

  difficultyBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
  },

  difficultyText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption - 1,
    fontWeight: "600",
  },

  equipmentBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
    backgroundColor: GymColors.background.surface,
  },

  equipmentText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption - 1,
    fontWeight: "600",
  },

  typeText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  expandedContent: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: GymColors.background.surface,
  },

  muscleLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  instructions: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});