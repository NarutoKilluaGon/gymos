import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { Radius } from "@/constants/design";
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
    border: "#e0803f",
    wash: "rgba(224, 128, 63, 0.07)",
  },
  nourish: {
    border: "#81a996",
    wash: "rgba(129, 169, 150, 0.07)",
  },
  gold: {
    border: "#d4a24c",
    wash: "rgba(212, 162, 76, 0.07)",
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

  const content = (
    <>
      {toneConfig ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.wash,
            { backgroundColor: toneConfig.wash },
          ]}
        />
      ) : null}
      {children}
    </>
  );

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
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  wash: {
    borderRadius: Radius.card,
  },
});
