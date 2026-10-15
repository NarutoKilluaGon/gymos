import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { Q } from "@/constants/quiet";
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

  let bgColor: string = Q.color.ink;
  let textColor: string = Q.color.bg;
  let borderColor: string | undefined = undefined;

  if (v === "secondary") {
    bgColor = "transparent";
    textColor = theme.ink;
    borderColor = theme.line;
  } else if (v === "ghost") {
    bgColor = "transparent";
    textColor = theme.ink;
  } else if (v === "danger") {
    bgColor = "transparent";
    textColor = theme.ink;
    borderColor = theme.line;
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
        {
          backgroundColor: bgColor,
          borderColor: borderColor ?? "transparent",
          borderWidth: borderColor ? 1 : 0,
        },
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
    height: 58,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 17,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
});
