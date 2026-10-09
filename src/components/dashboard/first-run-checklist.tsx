import { Check, ChevronRight, Droplets, Dumbbell, Utensils, X } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ds/card";
import { PressableScale } from "@/components/ds/pressable-scale";
import { Font, Metric, Radius, Space, Type } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export type FirstRunChecklistCardProps = {
  mealsCount: number;
  hasWorkout: boolean;
  waterMl: number;
  onLogMeal: () => void;
  onStartWorkout: () => void;
  onAddWater: () => void;
  onDismiss: () => void;
};

export function FirstRunChecklistCard({
  mealsCount,
  hasWorkout,
  waterMl,
  onLogMeal,
  onStartWorkout,
  onAddWater,
  onDismiss,
}: FirstRunChecklistCardProps) {
  const theme = useTheme();

  const mealDone = mealsCount > 0;
  const workoutDone = hasWorkout;
  const waterDone = waterMl > 0;

  const completedCount = (mealDone ? 1 : 0) + (workoutDone ? 1 : 0) + (waterDone ? 1 : 0);

  // Auto-hide if all 3 are completed
  if (completedCount === 3) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[Type.eyebrow, { color: theme.acc }]}>GET STARTED</Text>
          <View style={[styles.badge, { backgroundColor: theme.card2 }]}>
            <Text style={[Type.meta, styles.badgeText, { color: theme.ink }]}>
              {`${completedCount}/3 completed`}
            </Text>
          </View>
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Dismiss checklist"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.dismissBtn}
        >
          <X size={16} color={theme.mute} />
        </PressableScale>
      </View>

      <Text style={[Type.title, styles.title, { color: theme.ink }]}>
        Your first day on GymOS
      </Text>
      <Text style={[Type.meta, styles.subtitle, { color: theme.mute }]}>
        Complete these 3 steps to kick off your consistency.
      </Text>

      <View style={styles.list}>
        {/* Step 1: Log Meal */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Log your first meal"
          onPress={onLogMeal}
          style={[styles.item, { borderBottomColor: theme.line }]}
        >
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.checkCircle,
                mealDone
                  ? { backgroundColor: theme.acc, borderColor: theme.acc }
                  : { borderColor: theme.mute, backgroundColor: "transparent" },
              ]}
            >
              {mealDone ? <Check size={12} color={theme.accInk} /> : null}
            </View>
            <Utensils size={16} color={mealDone ? theme.acc : theme.mute} />
            <Text
              style={[
                Type.rowTitle,
                styles.itemLabel,
                { color: mealDone ? theme.mute : theme.ink },
                mealDone && styles.strikethrough,
              ]}
            >
              Log your first meal
            </Text>
          </View>
          <ChevronRight size={16} color={theme.mute} />
        </PressableScale>

        {/* Step 2: Start Workout */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Start your first workout"
          onPress={onStartWorkout}
          style={[styles.item, { borderBottomColor: theme.line }]}
        >
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.checkCircle,
                workoutDone
                  ? { backgroundColor: theme.acc, borderColor: theme.acc }
                  : { borderColor: theme.mute, backgroundColor: "transparent" },
              ]}
            >
              {workoutDone ? <Check size={12} color={theme.accInk} /> : null}
            </View>
            <Dumbbell size={16} color={workoutDone ? theme.acc : theme.mute} />
            <Text
              style={[
                Type.rowTitle,
                styles.itemLabel,
                { color: workoutDone ? theme.mute : theme.ink },
                workoutDone && styles.strikethrough,
              ]}
            >
              Start your first workout
            </Text>
          </View>
          <ChevronRight size={16} color={theme.mute} />
        </PressableScale>

        {/* Step 3: Add Water */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add water"
          onPress={onAddWater}
          style={[styles.item, styles.lastItem]}
        >
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.checkCircle,
                waterDone
                  ? { backgroundColor: theme.acc, borderColor: theme.acc }
                  : { borderColor: theme.mute, backgroundColor: "transparent" },
              ]}
            >
              {waterDone ? <Check size={12} color={theme.accInk} /> : null}
            </View>
            <Droplets size={16} color={waterDone ? theme.acc : theme.mute} />
            <Text
              style={[
                Type.rowTitle,
                styles.itemLabel,
                { color: waterDone ? theme.mute : theme.ink },
                waterDone && styles.strikethrough,
              ]}
            >
              Add water
            </Text>
          </View>
          <ChevronRight size={16} color={theme.mute} />
        </PressableScale>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Space.l,
    borderRadius: Radius.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  badge: {
    paddingHorizontal: Space.xs,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Font.sans,
    fontWeight: "600",
  },
  dismissBtn: {
    width: Metric.touchMin,
    height: Metric.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.control,
  },
  title: {
    marginTop: 2,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: Space.m,
  },
  list: {
    gap: 0,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Space.m,
    borderBottomWidth: 1,
    minHeight: Metric.touchMin,
  },
  lastItem: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.s,
    flex: 1,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    fontSize: 15,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
});
