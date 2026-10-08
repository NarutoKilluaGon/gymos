import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { Font } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();

  return (
    <Text
      style={[
        styles.eyebrow,
        { color: theme.acc },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();

  return (
    <Text
      style={[
        styles.label,
        { color: theme.mute },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  label: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "500",
    marginBottom: 6,
  },
});
