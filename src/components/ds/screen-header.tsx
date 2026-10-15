import { ChevronLeft } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Q } from "@/constants/quiet";
import { useTheme } from "@/contexts/theme-context";

export type ScreenHeaderProps = {
  eyebrow?: string;
  title: string | React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  eyebrow,
  title,
  right,
  onBack,
  style,
}: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      {(eyebrow || onBack || right) && (
        <View style={styles.topRow}>
          <View style={styles.leftGroup}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                style={styles.backButton}
              >
                <ChevronLeft size={22} strokeWidth={1.5} color={theme.ink} />
              </Pressable>
            ) : null}
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: theme.accent ?? theme.acc }]}>{eyebrow}</Text>
            ) : null}
          </View>

          {right ? <View style={styles.rightSlot}>{right}</View> : null}
        </View>
      )}

      {typeof title === "string" ? (
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      ) : (
        title
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginBottom: 6,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    fontFamily: Q.font.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  rightSlot: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: Q.font.displayMedium,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
});
