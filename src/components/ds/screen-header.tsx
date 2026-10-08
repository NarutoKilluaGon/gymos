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

import { Font } from "@/constants/design";
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
                style={[styles.backButton, { backgroundColor: theme.card2 }]}
              >
                <ChevronLeft size={20} strokeWidth={1.75} color={theme.ink} />
              </Pressable>
            ) : null}
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: theme.acc }]}>{eyebrow}</Text>
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
    marginBottom: 8,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eyebrow: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rightSlot: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: Font.serif,
    fontSize: 34,
    fontWeight: "300",
    lineHeight: 40,
  },
});
