import * as DocumentPicker from "expo-document-picker";
import { FolderInput } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { importFromUri } from "@/services/import";
import { showToast } from "@/utils/toast";

type ImportSheetProps = {
  onClose: () => void;
};

export function ImportSheet({ onClose }: ImportSheetProps) {
  const [importing, setImporting] = useState(false);

  async function runImport(uri: string, name: string) {
    if (importing) return;

    setImporting(true);
    try {
      const count = await importFromUri(uri);
      showToast(`Imported ${count} ${count === 1 ? "item" : "items"}`, "success");
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't import data",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleChoose() {
    if (importing) return;

    const result =
      await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });

    if (result.canceled) {
      return;
    }

    const asset = result.assets?.[0];

    if (!asset) {
      return;
    }

    Alert.alert(
      "Import this backup?",
      `Data in "${asset.name}" will replace matching data on this device. You can't undo this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: () => runImport(asset.uri, asset.name),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Import data</Text>

          <Text style={styles.subtitle}>
            Restore a backup on this device
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close import"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.body}>
        Pick a GymOS export file. Everything it contains is written to this
        device, replacing any matching data. Data that isn&apos;t in the file is
        kept. Nothing leaves your device.
      </Text>

      <View style={styles.iconContainer}>
        <FolderInput
          size={40}
          color={GymColors.text.tertiary}
        />
      </View>

      <Pressable
        onPress={handleChoose}
        disabled={importing}
        accessibilityRole="button"
        accessibilityLabel="Choose an export file"
        style={styles.importButton}
      >
        {importing ? (
          <ActivityIndicator
            color={GymColors.background.primary}
          />
        ) : (
          <Text style={styles.importButtonText}>
            Choose backup file
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

  importButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  importButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});