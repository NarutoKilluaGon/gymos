import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { Font, Metric, Radius } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Kind prop for forge-ui / nourish-ui backward compatibility. */
  kind?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant,
  kind,
  disabled,
  busy,
  icon,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const v = variant ?? kind ?? "primary";
  const off = disabled || busy;

  let bgColor = theme.acc;
  let textColor = theme.accInk;

  if (v === "secondary") {
    bgColor = theme.card2;
    textColor = theme.ink;
  } else if (v === "ghost") {
    bgColor = "transparent";
    textColor = theme.ink;
  } else if (v === "danger") {
    bgColor = "rgba(200, 99, 75, 0.08)";
    textColor = theme.bad;
  }

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      haptic={!off}
      style={[
        styles.button,
        { backgroundColor: bgColor },
        off && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor }]}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: Metric.buttonHeight,
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
});
