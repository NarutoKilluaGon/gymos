import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Q } from "@/constants/quiet";

export type QuietTabConfig = {
  name: "index" | "workouts" | "nutrition" | "hub";
  href: "/" | "/workouts" | "/nutrition" | "/hub";
  label: string;
  accent: string;
};

export const QUIET_NAVIGATION_TABS: readonly QuietTabConfig[] = [
  { name: "index", href: "/", label: "Home", accent: Q.accent.brass },
  { name: "workouts", href: "/workouts", label: "Forge", accent: Q.accent.ember },
  { name: "nutrition", href: "/nutrition", label: "Nourish", accent: Q.accent.sage },
  { name: "hub", href: "/hub", label: "Hub", accent: Q.accent.brass },
] as const;

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />

      <TabList asChild>
        <CustomTabList bottomInset={bottomInset}>
          {QUIET_NAVIGATION_TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <QuietTabTriggerButton
                label={tab.label}
                accent={tab.accent}
              />
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function QuietTabTriggerButton({
  label,
  accent,
  isFocused,
  ...props
}: TabTriggerSlotProps & { label: string; accent: string }) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.tabButtonPressed,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: isFocused ? accent : "transparent" },
        ]}
      />
      <Text
        style={[
          styles.tabLabel,
          isFocused ? styles.tabLabelFocused : styles.tabLabelUnfocused,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CustomTabList({
  children,
  bottomInset,
  ...props
}: TabListProps & { bottomInset: number }) {
  return (
    <View
      {...props}
      style={[styles.tabListContainer, { paddingBottom: bottomInset }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Q.color.bg,
  },
  slot: {
    flex: 1,
  },
  tabListContainer: {
    width: "100%",
    height: 74,
    backgroundColor: Q.color.bg,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    boxSizing: "border-box",
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 6,
  },
  tabLabel: {
    fontSize: 14,
  },
  tabLabelUnfocused: {
    fontFamily: Q.font.sansMedium,
    fontWeight: "500",
    color: Q.color.mute,
  },
  tabLabelFocused: {
    fontFamily: Q.font.sansMedium,
    fontWeight: "600",
    color: Q.color.ink,
  },
});
