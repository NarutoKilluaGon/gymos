import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/contexts/theme-context";

export function Bar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const theme = useTheme();
  const barColor = color ?? theme.acc;

  const raw = max > 0 ? value / max : 0;
  const ratio = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;

  return (
    <View style={[styles.track, { height, backgroundColor: theme.card2 }]}>
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
