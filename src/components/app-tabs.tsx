import { NativeTabs } from "expo-router/unstable-native-tabs";

import { GymColors } from "@/constants/theme";

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={GymColors.background.primary}
      indicatorColor={GymColors.background.surface}
      labelStyle={{
        selected: {
          color: GymColors.text.primary,
        },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md={{ default: "home", selected: "home_filled" }}
          sf={{ default: "house", selected: "house.fill" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workouts">
        <NativeTabs.Trigger.Label>Workouts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md={{ default: "fitness_center", selected: "fitness_center" }}
          sf={{ default: "dumbbell", selected: "dumbbell.fill" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Label>Nutrition</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md={{ default: "restaurant", selected: "restaurant" }}
          sf={{ default: "fork.knife", selected: "fork.knife" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hub">
        <NativeTabs.Trigger.Label>Hub</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md={{ default: "grid_view", selected: "grid_view" }}
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
