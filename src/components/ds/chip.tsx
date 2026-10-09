import React from "react";
import {
  AccessibilityActionEvent,
  AccessibilityActionInfo,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { Font, Radius } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type ChipProps = {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
};

export function Chip({
  label,
  onPress,
  onLongPress,
  active,
  icon,
  disabled,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: ChipProps) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.acc : theme.card,
          borderColor: active ? theme.acc : theme.line,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          { color: active ? theme.accInk : theme.ink },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: {
    fontFamily: Font.sans,
    fontSize: 13,
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.4,
  },
});
