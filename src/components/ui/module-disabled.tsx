import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useModules } from "@/contexts/modules-context";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { ModuleId } from "@/storage/repositories/modules";
import type { LucideIcon } from "lucide-react-native";

type ModuleDisabledProps = {
  moduleId: ModuleId;
  title: string;
  description: string;
  Icon: LucideIcon;
};

export function ModuleDisabled({
  moduleId,
  title,
  description,
  Icon,
}: ModuleDisabledProps) {
  const { setEnabled } = useModules();

  async function handleEnable() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEnabled(moduleId, true);
  }

  function handleGoToHub() {
    router.push("/hub");
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={48} color={GymColors.text.tertiary} />
      </View>

      <Text style={styles.title}>{title} is disabled</Text>

      <Text style={styles.description}>{description}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Enable ${title}`}
        onPress={handleEnable}
        style={styles.enableButton}
      >
        <Text style={styles.enableButtonText}>
          Enable {title}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to Hub"
        onPress={handleGoToHub}
        style={styles.hubButton}
      >
        <Text style={styles.hubButtonText}>Go to Hub</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
  },

  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: Radius.extraLarge,
    backgroundColor: GymColors.background.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.four,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.two,
  },

  description: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.five,
  },

  enableButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.two,
  },

  enableButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  hubButton: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    width: "100%",
    alignItems: "center",
  },

  hubButtonText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
