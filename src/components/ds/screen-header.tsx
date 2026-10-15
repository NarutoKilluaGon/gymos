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
  /** Module name displayed on the left in meta13 600 module accent (e.g. "Forge", "Nourish", "Hub") */
  module?: string;
  /** Accent color for the module name */
  accentColor?: string;
  /** Secondary context on the right in meta13 mute (e.g. "Push · Thursday", "Thursday, 15 October") */
  context?: string | React.ReactNode;
  /** Optional back handler */
  onBack?: () => void;
  /** Optional right-side custom slot */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Backwards compatibility props */
  eyebrow?: string;
  title?: string | React.ReactNode;
};

export function ScreenHeader({
  module,
  accentColor,
  context,
  onBack,
  right,
  style,
  eyebrow,
  title,
}: ScreenHeaderProps) {
  const theme = useTheme();

  // Determine display name: module, eyebrow, or title
  const rawName =
    module ??
    eyebrow ??
    (typeof title === "string" ? title : undefined) ??
    "Forge";

  // Rename any visible screen titles from "Workouts" to "Forge", "Nutrition" to "Nourish"
  const moduleName =
    rawName === "FORGE" || rawName === "Workouts"
      ? "Forge"
      : rawName === "NOURISH" || rawName === "Nutrition"
        ? "Nourish"
        : rawName === "HUB"
          ? "Hub"
          : rawName;

  const accent =
    accentColor ??
    (moduleName === "Forge"
      ? Q.accent.ember
      : moduleName === "Nourish"
        ? Q.accent.sage
        : moduleName === "Hub"
          ? Q.accent.brass
          : theme.accent ?? theme.acc ?? Q.color.ink);

  const rightContent =
    right ??
    (context ? <Text style={styles.contextText}>{context}</Text> : null);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftGroup}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={onBack}
            style={styles.backButton}
          >
            <ChevronLeft size={20} strokeWidth={1.5} color={Q.color.mute} />
          </Pressable>
        ) : null}
        <Text style={[styles.moduleName, { color: accent }]}>{moduleName}</Text>
      </View>

      {rightContent ? <View style={styles.rightSlot}>{rightContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginBottom: 8,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  moduleName: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 13,
    fontWeight: "600",
  },
  contextText: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  rightSlot: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
