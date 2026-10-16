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

export function Card({
  children,
  onPress,
  style,
  testID,
  accessibilityRole,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    { borderTopColor: theme.line },
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
    // Quiet: no fill, no box, no accent rule. One hairline separates sections.
    backgroundColor: "transparent",
    borderWidth: 0,
    borderTopWidth: 1,
    borderRadius: Q.radius.none,
    paddingTop: 16,
    paddingBottom: 4,
  },
});
