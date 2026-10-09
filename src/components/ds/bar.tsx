import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/contexts/theme-context";

export function Bar({
  value,
  max,
  color,
  height = 6,
  trackColor,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  trackColor?: string;
}) {
  const theme = useTheme();
  const barColor = color ?? theme.acc;

  const raw = max > 0 ? value / max : 0;
  const ratio = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  const resolvedTrack =
    trackColor ??
    (color && color.startsWith("#") && color.length === 7
      ? `${color}33`
      : theme.card2);

  return (
    <View style={[styles.track, { height, backgroundColor: resolvedTrack }]}>
      <View
        style={{
          width: `${ratio * 100}%`,
          height,
          borderRadius: height,
          backgroundColor: barColor,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 6,
    overflow: "hidden",
  },
});
