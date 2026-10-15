import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Q } from "@/constants/quiet";
import { PressableScale } from "./pressable-scale";

export type QuietTabKey = "index" | "workouts" | "nutrition" | "hub";

export type QuietTabItem = {
  key: QuietTabKey;
  label: string;
  accent: string;
};

export const QUIET_TABS: readonly QuietTabItem[] = [
  { key: "index", label: "Home", accent: Q.accent.brass },
  { key: "workouts", label: "Forge", accent: Q.accent.ember },
  { key: "nutrition", label: "Nourish", accent: Q.accent.sage },
  { key: "hub", label: "Hub", accent: Q.accent.brass },
] as const;

export type QuietTabBarProps = {
  activeKey: QuietTabKey;
  onSelectTab: (key: QuietTabKey) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function QuietTabBar({
  activeKey,
  onSelectTab,
  style,
  testID,
}: QuietTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: bottomInset },
        style,
      ]}
      testID={testID}
      accessibilityRole="tablist"
    >
      {QUIET_TABS.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <PressableScale
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: isActive ? tab.accent : "transparent" },
              ]}
            />
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 74,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    backgroundColor: Q.color.bg,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    boxSizing: "border-box",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
  },
  labelInactive: {
    fontFamily: Q.font.sansMedium,
    fontWeight: "500",
    color: Q.color.mute,
  },
  labelActive: {
    fontFamily: Q.font.sansMedium,
    fontWeight: "600",
    color: Q.color.ink,
  },
});
