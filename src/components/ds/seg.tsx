import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Font, Metric, Radius } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type SegOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SegProps<T extends string | number> = {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: SegProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          backgroundColor: theme.card,
          borderColor: theme.line,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <PressableScale
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              active && [
                styles.itemActive,
                { backgroundColor: theme.card2 },
              ],
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.ink : theme.mute },
                active && styles.labelActive,
              ]}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    alignItems: "center",
  },
  item: {
    flex: 1,
    minHeight: Metric.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
  },
  itemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "500",
  },
  labelActive: {
    fontWeight: "600",
  },
});
