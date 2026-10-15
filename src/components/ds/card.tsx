import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { Q } from "@/constants/quiet";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type CardTone = "forge" | "nourish" | "gold";

export type CardProps = {
  children?: React.ReactNode;
  tone?: CardTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityRole?: "button" | "none";
  accessibilityLabel?: string;
};

const TONE_ACCENTS: Record<CardTone, { border: string; wash: string }> = {
  forge: {
    border: Q.accent.ember,
    wash: "transparent",
  },
  nourish: {
    border: Q.accent.sage,
    wash: "transparent",
  },
  gold: {
    border: Q.accent.brass,
    wash: "transparent",
  },
};

export function Card({
  children,
  tone,
  onPress,
  style,
  testID,
  accessibilityRole,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();

  const toneConfig = tone ? TONE_ACCENTS[tone] : null;

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: theme.card,
      borderColor: theme.line,
    },
    toneConfig && {
      borderTopColor: toneConfig.border,
      borderTopWidth: 2,
    },
    style,
  ];

  const content = <>{children}</>;

  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={cardStyle}
      >
        {content}
      </PressableScale>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={cardStyle}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Q.radius.none,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
});
