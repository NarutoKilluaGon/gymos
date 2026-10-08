import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Font } from "@/constants/design";
import { F } from "@/constants/forge-theme";
import { NumberField } from "@/components/workouts/number-field";
import { round1 } from "@/services/forge/load";
import type { WorkoutSet } from "@/types/gymos";

type SetRowProps = {
  set: WorkoutSet;
  setIndex: number;
  workSetNumber: number;
  unit: "kg" | "lb";
  bodyweight?: boolean;
  refSet?: { weight?: number; reps?: number };
  onToggleWarmup: () => void;
  onRemove: () => void;
  onWeightCommit: (weight: number) => void;
  onRepsCommit: (reps: number) => void;
  onToggleDone: () => void;
};

export function SetRow({
  set,
  setIndex,
  workSetNumber,
  unit,
  bodyweight = false,
  refSet,
  onToggleWarmup,
  onRemove,
  onWeightCommit,
  onRepsCommit,
  onToggleDone,
}: SetRowProps) {
  const checkScale = useRef(new Animated.Value(1)).current;
  const weightPlaceholder = refSet?.weight
    ? String(round1(refSet.weight))
    : bodyweight
      ? "+0"
      : "—";

  const repsPlaceholder = refSet?.reps ? String(refSet.reps) : "—";

  const prevText =
    refSet?.weight !== undefined && refSet?.reps !== undefined
      ? `${round1(refSet.weight)}×${refSet.reps}`
      : "—";

  return (
    <View style={styles.row}>
      {/* 1. SET / WARMUP BADGE */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          set.warmup
            ? "Warm-up set. Tap to make a work set"
            : "Tap to mark as warm-up"
        }
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggleWarmup();
        }}
        onLongPress={onRemove}
        style={[styles.badge, set.warmup && styles.badgeWarm]}
      >
        <Text style={[styles.badgeText, set.warmup && styles.badgeWarmText]}>
          {set.warmup ? "W" : String(workSetNumber)}
        </Text>
      </Pressable>

      {/* 2. WEIGHT INPUT */}
      <View style={styles.inputWrap}>
        <NumberField
          label={`Set ${setIndex + 1} weight`}
          decimal
          value={set.weight}
          placeholder={weightPlaceholder}
          onCommit={onWeightCommit}
        />
      </View>

      {/* 3. REPS INPUT */}
      <View style={styles.inputWrap}>
        <NumberField
          label={`Set ${setIndex + 1} reps`}
          value={set.reps}
          placeholder={repsPlaceholder}
          onCommit={onRepsCommit}
        />
      </View>

      {/* 4. PREV COLUMN */}
      <View style={styles.prevWrap}>
        <Text style={styles.prevText}>{prevText}</Text>
      </View>

      {/* 5. DONE CHECKBOX */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={`Set ${setIndex + 1} done`}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.sequence([
            Animated.timing(checkScale, {
              toValue: 1.18,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              speed: 40,
              bounciness: 6,
              useNativeDriver: true,
            }),
          ]).start();
          onToggleDone();
        }}
      >
        <Animated.View
          style={[
            styles.check,
            set.completed && styles.checkOn,
            { transform: [{ scale: checkScale }] },
          ]}
        >
          <Check
            size={20}
            strokeWidth={2.5}
            color={set.completed ? F.accInk : F.dim}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: F.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: F.line,
  },
  badgeWarm: {
    borderColor: F.warm,
    backgroundColor: "rgba(217, 164, 65, 0.15)",
  },
  badgeText: {
    fontFamily: Font.sans,
    fontSize: 13,
    fontWeight: "700",
    color: F.mute,
    fontVariant: ["tabular-nums"],
  },
  badgeWarmText: {
    color: F.warm,
  },
  inputWrap: {
    flex: 1,
    maxWidth: 80,
  },
  prevWrap: {
    width: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  prevText: {
    fontFamily: Font.sans,
    fontSize: 13,
    color: F.dim,
    fontVariant: ["tabular-nums"],
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: F.acc,
    borderColor: F.acc,
  },
});
