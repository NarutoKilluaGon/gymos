import { Dumbbell, LineChart, Utensils } from "lucide-react-native";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useModules } from "@/contexts/modules-context";
import { FEATURES } from "@/constants/features";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { ModuleId } from "@/storage/repositories/modules";

const MODULES: {
  id: ModuleId;
  name: string;
  description: string;
  Icon: typeof Dumbbell;
}[] = [
  {
    id: "workouts",
    name: "Workouts",
    description: "Sessions, routines, exercises",
    Icon: Dumbbell,
  },
  {
    id: "nutrition",
    name: "Nutrition",
    description: "Meals, protein, calories",
    Icon: Utensils,
  },
  ...(FEATURES.progress
    ? [
        {
          id: "progress" as const,
          name: "Progress",
          description: "Charts and measurements",
          Icon: LineChart,
        },
      ]
    : []),
];

type ModulesSheetProps = {
  onClose: () => void;
};

export function ModulesSheet({ onClose }: ModulesSheetProps) {
  const { enabled, setEnabled } = useModules();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Modules</Text>

          <Text style={styles.subtitle}>
            Hide modules you don&apos;t use. Your data is always kept.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close modules"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {MODULES.map(({ id, name, description, Icon }) => (
          <View key={id} style={styles.row}>
            <View style={styles.rowMain}>
              <View style={styles.iconContainer}>
                <Icon size={20} color={GymColors.text.primary} />
              </View>

              <View style={styles.textBlock}>
                <Text style={styles.rowText}>{name}</Text>

                <Text style={styles.rowSubtitle}>{description}</Text>
              </View>
            </View>

            <Switch
              accessibilityLabel={`Toggle ${name} module`}
              value={enabled[id]}
              onValueChange={(value) => setEnabled(id, value)}
              trackColor={{
                false: GymColors.background.surface,
                true: GymColors.semantic.accent,
              }}
              thumbColor={GymColors.background.primary}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxHeight: "75%",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: GymColors.text.secondary,
    fontSize: 30,
    fontWeight: "300",
  },

  list: {
    gap: Spacing.two,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
  },

  rowText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  rowSubtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },
});