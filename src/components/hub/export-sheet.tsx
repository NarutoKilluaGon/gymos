import { Share2 } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { shareExport } from "@/services/export";
import { showToast } from "@/utils/toast";

type ExportSheetProps = {
  onClose: () => void;
};

export function ExportSheet({ onClose }: ExportSheetProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;

    setExporting(true);
    try {
      await shareExport();
      showToast("Data exported", "success");
    } catch {
      showToast("Couldn't export data");
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Export data</Text>

          <Text style={styles.subtitle}>
            Keep a copy of your history, offline.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close export"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.body}>
        GymOS exports a single JSON file with everything this app
        stores — workouts, meals, measurements, journal, settings,
        and the full event log. Nothing leaves your device.
      </Text>

      <View style={styles.iconContainer}>
        <Share2
          size={40}
          color={GymColors.text.tertiary}
        />
      </View>

      <Pressable
        onPress={handleExport}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Export data"
        style={styles.exportButton}
      >
        {exporting ? (
          <ActivityIndicator
            color={GymColors.background.primary}
          />
        ) : (
          <Text style={styles.exportButtonText}>
            Export my data
          </Text>
        )}
      </Pressable>
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

  body: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
  },

  iconContainer: {
    alignItems: "center",
    marginVertical: Spacing.five,
  },

  exportButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  exportButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});