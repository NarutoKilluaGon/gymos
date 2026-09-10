import Constants from "expo-constants";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";

type AboutSheetProps = {
  onClose: () => void;
};

export function AboutSheet({ onClose }: AboutSheetProps) {
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>About GymOS</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close About"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>VERSION</Text>
        <Text style={styles.value}>{version}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>PHILOSOPHY</Text>
        <Text style={styles.body}>
          Privacy-first. Offline-native. Your data lives on your
          device — you own it. GymOS is a calm corner for the
          things that do not crowd the daily tracker.
        </Text>
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
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
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

  block: {
    marginBottom: Spacing.four,
  },

  label: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  value: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  body: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
  },
});