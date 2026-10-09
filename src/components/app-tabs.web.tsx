import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HOME, Metric, Radius, Space } from "@/constants/design";

export default function AppTabs() {
  return (
    <Tabs style={styles.tabsRoot}>
      <TabSlot style={styles.slot} />

      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>

          <TabTrigger name="workouts" href="/workouts" asChild>
            <TabButton>Workouts</TabButton>
          </TabTrigger>

          <TabTrigger name="nutrition" href="/nutrition" asChild>
            <TabButton>Nutrition</TabButton>
          </TabTrigger>

          <TabTrigger name="hub" href="/hub" asChild>
            <TabButton>Hub</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && styles.tabButtonFocused,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
    backgroundColor: HOME.bg,
  },

  slot: {
    flex: 1,
  },

  tabListContainer: {
    width: "100%",
    backgroundColor: HOME.bg,
    borderTopWidth: 1,
    borderTopColor: HOME.line,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.m,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: Space.xs,
  },

  tabButton: {
    minHeight: Metric.touchMin,
    minWidth: Metric.touchMin,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: Space.xs,
    paddingHorizontal: Space.m,
    borderRadius: Radius.control,
  },

  tabButtonFocused: {
    backgroundColor: HOME.card2,
  },

  tabText: {
    color: HOME.mute,
    fontSize: 14,
    fontWeight: "500",
  },

  tabTextFocused: {
    color: HOME.ink,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.7,
  },
});
