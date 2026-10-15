import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useModules } from "@/contexts/modules-context";
import { Q } from "@/constants/quiet";
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
        <Icon size={40} color={Q.color.mute} />
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
    paddingHorizontal: 24,
    paddingBottom: 48,
    backgroundColor: Q.color.bg,
  },

  iconContainer: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontFamily: Q.font.displayMedium,
    color: Q.color.ink,
    fontSize: 24,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
  },

  description: {
    fontFamily: Q.font.sansRegular,
    color: Q.color.mute,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 280,
  },

  enableButton: {
    backgroundColor: Q.color.ink,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },

  enableButtonText: {
    fontFamily: Q.font.sansSemiBold,
    color: Q.color.bg,
    fontSize: 15,
    fontWeight: "600",
  },

  hubButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Q.color.line,
    minHeight: 48,
    justifyContent: "center",
    width: "100%",
    alignItems: "center",
  },

  hubButtonText: {
    fontFamily: Q.font.sansMedium,
    color: Q.color.mute,
    fontSize: 15,
    fontWeight: "500",
  },
});
