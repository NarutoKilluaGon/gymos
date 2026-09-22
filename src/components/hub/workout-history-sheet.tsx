import { ChevronLeft, Dumbbell, Flame } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { findCardioActivity } from "@/data/cardio";
import {
  formatDuration,
  formatSetName,
  formatVolume,
  formatWorkoutDate,
  getWorkoutHistory,
  workoutDurationMin,
  workoutSetCount,
  workoutVolume,
} from "@/services/workout-history";
import type { WorkoutSession } from "@/types/gymos";

type WorkoutHistorySheetProps = {
  onClose: () => void;
};

export function WorkoutHistorySheet({
  onClose,
}: WorkoutHistorySheetProps) {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    let mounted = true;

    getWorkoutHistory()
      .then((history) => {
        if (mounted) {
          setWorkouts(history);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setWorkouts([]);
          setLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {selected ? (
        <WorkoutDetail
          workout={selected}
          onBack={() => setSelected(null)}
          onClose={onClose}
        />
      ) : (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Workout history</Text>

              <Text style={styles.subtitle}>
                Review your past sessions
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close workout history"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.list}
          >
            {loaded && workouts.length === 0 ? (
              <View style={styles.emptyState}>
                <Dumbbell
                  size={40}
                  color={GymColors.text.tertiary}
                />

                <Text style={styles.emptyTitle}>No workouts yet</Text>

                <Text style={styles.emptyBody}>
                  Finish a workout and it&apos;ll appear here for review.
                </Text>
              </View>
            ) : (
              workouts.map((workout) => (
                <WorkoutRow
                  key={workout.id}
                  workout={workout}
                  onPress={() => setSelected(workout)}
                />
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function WorkoutRow({
  workout,
  onPress,
}: {
  workout: WorkoutSession;
  onPress: () => void;
}) {
  const volume = workoutVolume(workout);
  const setCount = workoutSetCount(workout);
  const exerciseCount = workout.exercises.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${workout.name} workout`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{workout.name}</Text>

        <Text style={styles.rowMeta}>
          {formatWorkoutDate(workout.startedAt)} ·{" "}
          {formatDuration(workoutDurationMin(workout))} ·{" "}
          {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"} ·{" "}
          {setCount} set{setCount === 1 ? "" : "s"}
        </Text>

        {workout.notes ? (
          <Text style={styles.rowNotes} numberOfLines={1}>
            {workout.notes}
          </Text>
        ) : null}
      </View>

      <View style={styles.volumeBadge}>
        <Text style={styles.volumeValue}>
          {formatVolume(volume)}
        </Text>
        <Text style={styles.volumeUnit}>volume</Text>
      </View>
    </Pressable>
  );
}

function WorkoutDetail({
  workout,
  onBack,
  onClose,
}: {
  workout: WorkoutSession;
  onBack: () => void;
  onClose: () => void;
}) {
  const volume = workoutVolume(workout);
  const duration = formatDuration(workoutDurationMin(workout));
  const cardio = workout.cardio ?? [];

  return (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to workout list"
          onPress={onBack}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={GymColors.text.primary} />
        </Pressable>

        <View style={styles.detailTitleBlock}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {workout.name}
          </Text>

          <Text style={styles.detailMeta}>
            {formatWorkoutDate(workout.startedAt)} · {duration} ·{" "}
            {formatVolume(volume)} volume
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close workout history"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {workout.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{workout.notes}</Text>
          </View>
        ) : null}

        {workout.exercises.length === 0 &&
        cardio.length === 0 &&
        !workout.notes ? (
          <View style={styles.emptyState}>
            <Dumbbell
              size={40}
              color={GymColors.text.tertiary}
            />

            <Text style={styles.emptyTitle}>Nothing logged</Text>

            <Text style={styles.emptyBody}>
              This workout has no exercises or cardio entries.
            </Text>
          </View>
        ) : null}

        {workout.exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Dumbbell
                size={18}
                color={GymColors.semantic.accent}
              />

              <Text style={styles.exerciseName}>
                {exercise.name}
              </Text>
            </View>

            <View style={styles.setsList}>
              {exercise.sets.map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setIndex}>{index + 1}</Text>
                  <Text
                    style={[
                      styles.setName,
                      !set.completed && styles.setIncomplete,
                    ]}
                  >
                    {formatSetName(set)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {cardio.length > 0 ? (
          <View style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Flame size={18} color={GymColors.semantic.accent} />

              <Text style={styles.exerciseName}>Cardio</Text>
            </View>

            <View style={styles.setsList}>
              {cardio.map((entry) => {
                const label =
                  entry.activity === "custom" && entry.name
                    ? entry.name
                    : findCardioActivity(entry.activity)?.label ??
                      "Cardio";

                const distance = entry.distanceKm
                  ? ` · ${entry.distanceKm} km`
                  : "";

                return (
                  <View key={entry.id} style={styles.setRow}>
                    <Text style={styles.setIndex}>•</Text>
                    <Text style={styles.setName}>
                      {label} — {formatDuration(entry.durationMin)}
                      {distance}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
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
    maxHeight: "85%",
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

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  detailTitleBlock: {
    flex: 1,
    alignItems: "center",
  },

  detailTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  detailMeta: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  list: {
    flexGrow: 0,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  emptyBody: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "center",
    maxWidth: 260,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },

  rowPressed: {
    opacity: 0.7,
  },

  rowMain: {
    flex: 1,
  },

  rowTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  rowMeta: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  rowNotes: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
    fontStyle: "italic",
  },

  volumeBadge: {
    marginLeft: Spacing.two,
    alignItems: "flex-end",
  },

  volumeValue: {
    color: GymColors.semantic.accent,
    fontSize: Typography.h3,
    fontWeight: "700",
  },

  volumeUnit: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  notesCard: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  notesLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  notesText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    marginTop: Spacing.half,
  },

  exerciseCard: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  exerciseName: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  setsList: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },

  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  setIndex: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    width: 16,
  },

  setName: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  setIncomplete: {
    color: GymColors.text.tertiary,
    textDecorationLine: "line-through",
  },
});