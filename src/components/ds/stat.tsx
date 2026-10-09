import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Font } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export type StatProps = {
  value: string | number;
  unit?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Stat({ value, unit, label, style }: StatProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            { color: theme.ink },
          ]}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.unit, { color: theme.mute }]}>{unit}</Text>
        ) : null}
      </View>

      {label ? (
        <Text style={[styles.label, { color: theme.mute }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  value: {
    fontFamily: Font.serif,
    fontSize: 26,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontFamily: Font.sans,
    fontSize: 13,
  },
  label: {
    fontFamily: Font.sans,
    fontSize: 12,
    marginTop: 2,
  },
});
