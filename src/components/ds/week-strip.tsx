import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Q } from "@/constants/quiet";
import { PressableScale } from "./pressable-scale";

export type WeekStripProps = {
  /** Completed day indices (0 = Monday, 6 = Sunday). */
  completedDays?: number[];
  /** Index of today in current week (0 = Monday, 6 = Sunday). */
  todayIndex?: number;
  /** Optional callback when a day is tapped. */
  onSelectDay?: (index: number) => void;
  /** Currently selected day index if distinct from today. */
  selectedIndex?: number;
  /** Accent color for completed days (defaults to Q.accent.brass). */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekStrip({
  completedDays = [],
  todayIndex = 3, // Defaults to Thursday if unspecified
  onSelectDay,
  selectedIndex,
  accentColor = Q.accent.brass,
  style,
  testID,
}: WeekStripProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {DAY_LABELS.map((label, index) => {
        const isToday = index === todayIndex;
        const isSelected = selectedIndex !== undefined && selectedIndex === index;
        const isCompleted = completedDays.includes(index);
        const isPast = index < todayIndex;

        let dotBg: string = "transparent";
        let dotBorder: string = Q.color.line; // Future default #2B2924

        if (isCompleted) {
          dotBg = accentColor;
          dotBorder = accentColor;
        } else if (isToday) {
          dotBg = isCompleted ? accentColor : "transparent";
          dotBorder = accentColor;
        } else if (isPast) {
          dotBorder = Q.color.lineStrong; // Past incomplete #3A3731
        }

        const dayContent = (
          <View style={styles.dayColumn}>
            <Text
              style={[
                styles.dayLabel,
                isToday ? styles.dayLabelToday : styles.dayLabelNormal,
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: dotBg,
                  borderColor: dotBorder,
                },
                isSelected && styles.dotSelected,
              ]}
            />
          </View>
        );

        if (onSelectDay) {
          return (
            <PressableScale
              key={index}
              onPress={() => onSelectDay(index)}
              style={styles.dayPressable}
            >
              {dayContent}
            </PressableScale>
          );
        }

        return (
          <View key={index} style={styles.dayPressable}>
            {dayContent}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: 12,
  },
  dayPressable: {
    flex: 1,
    alignItems: "center",
  },
  dayColumn: {
    alignItems: "center",
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: Q.font.sansRegular,
  },
  dayLabelNormal: {
    color: Q.color.mute,
    fontWeight: "400",
  },
  dayLabelToday: {
    color: Q.color.ink,
    fontFamily: Q.font.sansMedium,
    fontWeight: "600",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    borderWidth: 1.5,
  },
  dotSelected: {
    transform: [{ scale: 1.25 }],
  },
});
