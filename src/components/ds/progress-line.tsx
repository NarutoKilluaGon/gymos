import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Q } from "@/constants/quiet";

export type ProgressLineProps = {
  /** Current value (e.g., eaten kcal, steps taken, ml drunk). */
  value: number;
  /** Target budget/goal (e.g., 2258 kcal, 8000 steps). */
  target: number;
  /** Primary accent color under budget (defaults to Q.accent.sage). */
  color?: string;
  /** Over-budget color (defaults to Q.accent.red). */
  overColor?: string;
  /** Track background color (defaults to Q.color.line). */
  trackColor?: string;
  /** Height of the line track in px (defaults to 2). */
  height?: number;
  /** Whether to show a 1.5px vertical tick at the 100% budget mark. */
  showTargetTick?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ProgressLine({
  value,
  target,
  color = Q.accent.sage,
  overColor = Q.accent.red,
  trackColor = Q.color.line,
  height = 2,
  showTargetTick = false,
  style,
  testID,
}: ProgressLineProps) {
  const safeTarget = target > 0 ? target : 1;
  const isOver = value > safeTarget;

  // Percentage widths
  let underPercent = 0;
  let overPercent = 0;
  let tickPosition = 100;

  if (isOver) {
    // When over budget, total scale represents `value`
    // Target tick sits at target / value
    const targetRatio = Math.max(0.05, Math.min(0.95, safeTarget / value));
    tickPosition = targetRatio * 100;
    underPercent = tickPosition;
    overPercent = (1 - targetRatio) * 100;
  } else {
    // Under budget: normal fill ratio of target
    const ratio = Math.max(0, Math.min(1, value / safeTarget));
    underPercent = ratio * 100;
    overPercent = 0;
    tickPosition = 100;
  }

  const containerHeight = Math.max(height + 8, 10);
  const trackTop = (containerHeight - height) / 2;

  return (
    <View
      testID={testID}
      style={[styles.container, { height: containerHeight }, style]}
    >
      {/* Background Track */}
      <View
        style={[
          styles.track,
          {
            top: trackTop,
            height,
            backgroundColor: trackColor,
          },
        ]}
      />

      {/* Under budget / normal fill */}
      {underPercent > 0 && (
        <View
          style={[
            styles.fill,
            {
              left: 0,
              top: trackTop,
              width: `${underPercent}%`,
              height,
              backgroundColor: color,
            },
          ]}
        />
      )}

      {/* Over budget fill */}
      {isOver && overPercent > 0 && (
        <View
          style={[
            styles.fill,
            {
              left: `${underPercent}%`,
              top: trackTop,
              width: `${overPercent}%`,
              height,
              backgroundColor: overColor,
            },
          ]}
        />
      )}

      {/* Target tick line */}
      {showTargetTick && (
        <View
          style={[
            styles.tick,
            {
              left: `${tickPosition}%`,
              top: 0,
              height: containerHeight,
              backgroundColor: Q.color.ink,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 1,
  },
  fill: {
    position: "absolute",
    borderRadius: 1,
  },
  tick: {
    position: "absolute",
    width: 1.5,
    borderRadius: 0.75,
  },
});
