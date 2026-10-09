import React from "react";
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { Metric } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type IconButtonProps = {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  style,
  disabled,
  testID,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: theme.card2 },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: Metric.touchMin,
    height: Metric.touchMin,
    borderRadius: Metric.touchMin / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.45,
  },
});
