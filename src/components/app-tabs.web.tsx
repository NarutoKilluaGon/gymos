import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Spacing } from "@/constants/theme";

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: "100%" }} />

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
  tabListContainer: {
    position: "absolute",
    width: "100%",
    padding: Spacing.three,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  tabButton: {
    backgroundColor: GymColors.background.card,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },

  tabButtonFocused: {
    backgroundColor: GymColors.background.surface,
  },

  tabText: {
    color: GymColors.text.secondary,
    fontSize: 13,
  },

  tabTextFocused: {
    color: GymColors.text.primary,
  },

  pressed: {
    opacity: 0.7,
  },
});
