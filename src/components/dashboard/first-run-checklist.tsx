import { Check, ChevronRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ds/pressable-scale";
import { Q } from "@/constants/quiet";

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
  const mealDone = mealsCount > 0;
  const workoutDone = hasWorkout;
  const waterDone = waterMl > 0;

  const completedCount =
    (mealDone ? 1 : 0) + (workoutDone ? 1 : 0) + (waterDone ? 1 : 0);

  // Auto-hide if all 3 are completed
  if (completedCount === 3) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>
          {`Get started · ${completedCount} of 3 done`}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Dismiss checklist"
          hitSlop={8}
          onPress={onDismiss}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </PressableScale>
      </View>

      <View style={styles.list}>
        {/* Step 1: Log Meal */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Log your first meal"
          onPress={mealDone ? undefined : onLogMeal}
          style={styles.item}
        >
          <Text style={[styles.itemLabel, mealDone && styles.itemLabelDone]}>
            Log your first meal
          </Text>
          {mealDone ? (
            <Check size={16} color={Q.color.mute} />
          ) : (
            <ChevronRight size={16} color={Q.color.mute} />
          )}
        </PressableScale>

        {/* Step 2: Start Workout */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Start your first workout"
          onPress={workoutDone ? undefined : onStartWorkout}
          style={styles.item}
        >
          <Text
            style={[styles.itemLabel, workoutDone && styles.itemLabelDone]}
          >
            Start your first workout
          </Text>
          {workoutDone ? (
            <Check size={16} color={Q.color.mute} />
          ) : (
            <ChevronRight size={16} color={Q.color.mute} />
          )}
        </PressableScale>

        {/* Step 3: Add Water */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add water"
          onPress={waterDone ? undefined : onAddWater}
          style={styles.item}
        >
          <Text style={[styles.itemLabel, waterDone && styles.itemLabelDone]}>
            Add water
          </Text>
          {waterDone ? (
            <Check size={16} color={Q.color.mute} />
          ) : (
            <ChevronRight size={16} color={Q.color.mute} />
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  dismissText: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  list: {
    width: "100%",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    minHeight: 44,
  },
  itemLabel: {
    fontFamily: Q.font.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    color: Q.color.ink,
  },
  itemLabelDone: {
    color: Q.color.mute,
  },
});
