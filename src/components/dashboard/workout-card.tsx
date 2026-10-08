import { router } from "expo-router";
import { CheckCircle2, Dumbbell, Play } from "lucide-react-native";
import { useEffect } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from "react-native";

import { Card } from "@/components/ds/card";
import { HOME } from "@/constants/design";
import { Spacing, Typography } from "@/constants/theme";
import type { PlanDay } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";

type WorkoutCardProps = {
  /** Today's workout, or null if none started yet. */
  workout?: WorkoutSession | null;
  /** Today's day from Forge's active plan, shown when no workout is active. */
  plannedDay?: PlanDay | null;
  /** Finished workout session from today, if any. */
  finishedToday?: WorkoutSession | null;
  /** True when today is scheduled as a rest day. */
  isRestDay?: boolean;
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

function PulsingPip() {
  const pulse = useAnimatedValue(1);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.pipContainer}>
      <Animated.View
        style={[
          styles.pipGlow,
          {
            opacity: pulse,
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <View style={styles.pipDot} />
    </View>
  );
}

export function WorkoutCard({
  workout,
  plannedDay,
  finishedToday,
  isRestDay = false,
}: WorkoutCardProps) {
  const active = workout ?? null;

  // 1. ACTIVE WORKOUT
  if (active) {
    const display = describeWorkout(active);
    return (
      <Card tone="forge" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.eyebrowGroup}>
            <PulsingPip />
            <Text style={styles.eyebrowActive}>{"TODAY'S WORKOUT"}</Text>
          </View>
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>IN PROGRESS</Text>
          </View>
        </View>

        <Text style={styles.title}>{display.title}</Text>
        <Text style={styles.message}>{display.message}</Text>

        <Pressable
          style={styles.actionButton}
          onPress={() => router.navigate("/workouts")}
          accessibilityRole="button"
          accessibilityLabel="Resume workout"
        >
          <Play size={18} color="#000" fill="#000" />
          <Text style={styles.actionButtonText}>Resume workout</Text>
        </Pressable>
      </Card>
    );
  }

  // 2. FINISHED WORKOUT TODAY (and no active workout)
  if (finishedToday && !plannedDay) {
    return (
      <Card tone="forge" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.eyebrowGroup}>
            <CheckCircle2 size={16} color="#10b981" />
            <Text style={styles.eyebrowDone}>WORKOUT COMPLETE</Text>
          </View>
        </View>

        <Text style={styles.title}>{finishedToday.name || "Workout done"}</Text>
        <Text style={styles.message}>
          {finishedToday.exercises.length} {finishedToday.exercises.length === 1 ? "exercise" : "exercises"} completed today. Great work!
        </Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.navigate("/workouts")}
          accessibilityRole="button"
          accessibilityLabel="Open workouts"
        >
          <Text style={styles.secondaryButtonText}>View workout history</Text>
        </Pressable>
      </Card>
    );
  }

  // 3. REST DAY
  if (isRestDay && !plannedDay) {
    return (
      <Card tone="forge" style={styles.card}>
        <Text style={styles.eyebrow}>REST & RECOVERY</Text>
        <Text style={styles.title}>Rest day</Text>
        <Text style={styles.message}>
          Recovery is where muscle grows. Prioritize protein, hydration, and 8 hours of sleep.
        </Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.navigate("/workouts")}
          accessibilityRole="button"
          accessibilityLabel="Open workouts"
        >
          <Text style={styles.secondaryButtonText}>Open workouts</Text>
        </Pressable>
      </Card>
    );
  }

  // 4. PLANNED DAY OR IDLE
  const display = plannedDay
    ? {
        title: plannedDay.name,
        message: `${exerciseCount(plannedDay)} ready — start from Workouts.`,
      }
    : {
        title: "No workout yet",
        message: "Start today's session to build momentum.",
      };

  return (
    <Card tone="forge" style={styles.card}>
      <Text style={styles.eyebrow}>WORKOUT SCHEDULED</Text>
      <Text style={styles.title}>{display.title}</Text>
      <Text style={styles.message}>{display.message}</Text>

      <Pressable
        style={styles.actionButton}
        onPress={() => router.navigate("/workouts")}
        accessibilityRole="button"
        accessibilityLabel="Open workouts"
      >
        <Dumbbell size={18} color="#000" />
        <Text style={styles.actionButtonText}>
          {plannedDay ? "Start workout" : "Open workouts"}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.one,
  },
  eyebrowGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pipContainer: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pipGlow: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(245, 158, 11, 0.4)",
  },
  pipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  eyebrow: {
    color: HOME.mute,
    fontSize: Typography.caption,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: Spacing.one,
  },
  eyebrowActive: {
    color: "#f59e0b",
    fontSize: Typography.caption,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  eyebrowDone: {
    color: "#10b981",
    fontSize: Typography.caption,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  liveTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  liveTagText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: HOME.ink,
    fontSize: Typography.h2,
    fontWeight: "600",
  },
  message: {
    color: HOME.mute,
    fontSize: Typography.body,
    marginTop: Spacing.one,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.two,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: HOME.acc,
    paddingHorizontal: Spacing.three,
  },
  actionButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.two,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: HOME.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
    paddingHorizontal: Spacing.three,
  },
  secondaryButtonText: {
    color: HOME.ink,
    fontSize: 15,
    fontWeight: "500",
  },
});