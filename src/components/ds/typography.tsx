import React from "react";
import { StyleProp, StyleSheet, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";

import { Type } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export type TypeRole = keyof typeof Type;

export type TextProps = Omit<RNTextProps, "role"> & {
  role?: TypeRole;
  style?: StyleProp<TextStyle>;
};

export function Text({ role = "body", style, ...props }: TextProps) {
  const theme = useTheme();
  const baseStyle = Type[role] ?? Type.body;

  // Serif roles or primary headings get ink color by default; meta/eyebrow get mute
  let defaultColor = theme.ink;
  if (role === "meta") defaultColor = theme.mute;
  if (role === "eyebrow") defaultColor = theme.acc;

  return (
    <RNText
      style={[{ color: defaultColor }, baseStyle, style]}
      {...props}
    />
  );
}

export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();

  return (
    <RNText
      style={[
        Type.eyebrow,
        { color: theme.acc },
        style,
      ]}
    >
      {children}
    </RNText>
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
    <RNText
      style={[
        Type.eyebrow,
        styles.labelMargin,
        { color: theme.mute },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  labelMargin: {
    marginBottom: 6,
  },
});
