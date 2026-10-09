import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Font } from "@/constants/design";
import { F } from "@/constants/forge-theme";
import { tap } from "@/components/workouts/forge-ui";
import { SetRow } from "@/components/workouts/set-row";
import type { WorkoutExercise, WorkoutSet } from "@/types/gymos";
import { displayName, formatSetGroup } from "@/utils/format";

type PreviousHistory = {
  exercise: WorkoutExercise;
  sets: WorkoutSet[];
};

type ExerciseCardProps = {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  unit: "kg" | "lb";
  previous?: PreviousHistory | null;
  isLinkedAbove?: boolean;
  isLinkedBelow?: boolean;
  onOptionsPress: () => void;
  onAddSet: () => void;
  onToggleWarmup: (setIndex: number) => void;
  onRemoveSet: (setIndex: number) => void;
  onWeightCommit: (setIndex: number, setId: string, weight: number) => void;
  onRepsCommit: (setIndex: number, setId: string, reps: number) => void;
  onToggleDone: (setIndex: number) => void;
};

export function ExerciseCard({
  exercise,
  exerciseIndex,
  unit,
  previous,
  isLinkedAbove = false,
  isLinkedBelow = false,
  onOptionsPress,
  onAddSet,
  onToggleWarmup,
  onRemoveSet,
  onWeightCommit,
  onRepsCommit,
  onToggleDone,
}: ExerciseCardProps) {
  // Format the "Last" line with shared set group notation:
  // e.g., "Last · 3 × 20 @ 35 kg" or "Last · 35 kg × 20, 30 kg × 12"
  const lastLine = previous
    ? `Last · ${formatSetGroup(previous.sets, unit, previous.exercise.bodyweight)}`
    : "First time";

  let workSetCounter = 0;

  return (
    <View
      style={[
        styles.card,
        (isLinkedAbove || isLinkedBelow) && styles.linkedRail,
        isLinkedAbove && styles.linkedAbove,
      ]}
    >
      {/* Superset indicator */}
      {isLinkedBelow && !isLinkedAbove ? (
        <Text style={styles.supersetTag}>SUPERSET</Text>
      ) : null}

      {/* Top Header: Index badge + Exercise Name + Overflow ⋯ */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexBadgeText}>{exerciseIndex + 1}</Text>
          </View>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {displayName(exercise.name)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Options for ${exercise.name}`}
          onPress={() => {
            tap();
            onOptionsPress();
          }}
          style={styles.overflowBtn}
          hitSlop={8}
        >
          <Text style={styles.overflowBtnText}>⋯</Text>
        </Pressable>
      </View>

      {/* "Last" summary line */}
      <Text style={styles.lastLine} numberOfLines={1}>
        {lastLine}
      </Text>

      {/* Progress or tip badges */}
      {exercise.progressed ? (
        <Text style={styles.progressText}>
          {`Hit every rep last time. Up ${unit === "kg" ? "2.5 kg" : "5 lb"}.`}
        </Text>
      ) : null}
      {exercise.bodyweight ? (
        <Text style={styles.bodyweightHint}>
          Bodyweight. The weight box is extra load (minus if assisted).
        </Text>
      ) : null}
      {exercise.tip ? (
        <Text style={styles.tipText}>{`Tip · ${exercise.tip}`}</Text>
      ) : null}

      <View style={styles.divider} />

      {/* Table Column Headers (rendered once) */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.thSet]}>SET</Text>
        <Text style={[styles.th, styles.thInput]}>{unit.toUpperCase()}</Text>
        <Text style={[styles.th, styles.thInput]}>REPS</Text>
        <Text style={[styles.th, styles.thPrev]}>PREV</Text>
        <Text style={[styles.th, styles.thCheck]}>✓</Text>
      </View>

      {/* Set Rows or Empty Hint */}
      {exercise.sets.length === 0 ? (
        <Text style={styles.emptyHint}>
          No sets yet. Tap + Add set to start
        </Text>
      ) : (
        exercise.sets.map((set, setIndex) => {
          if (!set.warmup) workSetCounter += 1;
          const refSet = previous
            ? previous.sets[setIndex] ?? previous.sets[previous.sets.length - 1]
            : undefined;

          return (
            <SetRow
              key={set.id}
              set={set}
              setIndex={setIndex}
              workSetNumber={workSetCounter}
              unit={unit}
              bodyweight={exercise.bodyweight}
              refSet={refSet}
              onToggleWarmup={() => onToggleWarmup(setIndex)}
              onRemove={() => onRemoveSet(setIndex)}
              onWeightCommit={(weight) =>
                onWeightCommit(setIndex, set.id, weight)
              }
              onRepsCommit={(reps) => onRepsCommit(setIndex, set.id, reps)}
              onToggleDone={() => onToggleDone(setIndex)}
            />
          );
        })
      )}

      {/* Note text if present */}
      {exercise.note ? (
        <Text style={styles.noteText}>{exercise.note}</Text>
      ) : null}

      {/* Bottom "+ Add set" full-width quiet button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add set"
        onPress={() => {
          tap();
          onAddSet();
        }}
        style={styles.addSetButton}
      >
        <Plus size={16} color={F.acc} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: F.card,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: F.line,
    padding: 16,
    marginTop: 16,
  },
  linkedRail: {
    borderLeftWidth: 3,
    borderLeftColor: F.acc,
    paddingLeft: 14,
  },
  linkedAbove: {
    marginTop: 8,
  },
  supersetTag: {
    color: F.acc,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: F.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: {
    fontFamily: Font.sans,
    fontSize: 12,
    fontWeight: "700",
    color: F.mute,
  },
  exerciseName: {
    fontFamily: Font.serif,
    fontSize: 20,
    fontWeight: "600",
    color: F.ink,
    flexShrink: 1,
  },
  overflowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    marginRight: -8,
  },
  overflowBtnText: {
    fontFamily: Font.sans,
    fontSize: 22,
    fontWeight: "700",
    color: F.mute,
    lineHeight: 24,
  },
  lastLine: {
    fontFamily: Font.sans,
    fontSize: 13,
    color: F.mute,
    marginTop: 4,
    marginLeft: 34,
  },
  progressText: {
    fontFamily: Font.sans,
    color: F.ok,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 34,
  },
  bodyweightHint: {
    fontFamily: Font.sans,
    color: F.mute,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 34,
  },
  tipText: {
    fontFamily: Font.sans,
    color: F.mute,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
    marginLeft: 34,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: F.line,
    marginTop: 12,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  th: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
    color: F.mute,
    textAlign: "center",
  },
  thSet: {
    width: 32,
    textAlign: "center",
  },
  thInput: {
    flex: 1,
    maxWidth: 80,
  },
  thPrev: {
    width: 58,
  },
  thCheck: {
    width: 44,
  },
  emptyHint: {
    fontFamily: Font.sans,
    color: F.dim,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
  },
  noteText: {
    fontFamily: Font.sans,
    color: F.mute,
    fontSize: 13,
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: F.line,
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderStyle: "dashed",
    marginTop: 12,
  },
  addSetText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "600",
    color: F.acc,
  },
});
