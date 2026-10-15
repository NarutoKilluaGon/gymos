import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Q } from "@/constants/quiet";

export type SetBarProps = {
  /** Total number of sets in this exercise. */
  totalSets: number;
  /** Number of sets already logged/completed. */
  completedSets: number;
  /** Active set index currently being logged. */
  activeSetIndex?: number;
  /** Accent color for logged sets (defaults to Q.accent.ember). */
  accentColor?: string;
  /** Inactive/pending set segment color (defaults to Q.color.line). */
  trackColor?: string;
  /** Height in px (defaults to 3). */
  height?: number;
  /** Gap between set segments in px (defaults to 6). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SetBar({
  totalSets,
  completedSets,
  activeSetIndex,
  accentColor = Q.accent.ember,
  trackColor = Q.color.line,
  height = 3,
  gap = 6,
  style,
  testID,
}: SetBarProps) {
  const count = Math.max(1, totalSets);

  return (
    <View style={[styles.container, { gap }, style]} testID={testID}>
      {Array.from({ length: count }).map((_, index) => {
        const isCompleted = index < completedSets;
        const isActive = activeSetIndex !== undefined && index === activeSetIndex;

        let segmentColor = trackColor;
        if (isCompleted) {
          segmentColor = accentColor;
        } else if (isActive) {
          segmentColor = `${accentColor}88`;
        }

        return (
          <View
            key={index}
            style={[
              styles.segment,
              {
                height,
                backgroundColor: segmentColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  segment: {
    flex: 1,
    borderRadius: 2,
  },
});
