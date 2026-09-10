import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";

type WeightSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (weight: number) => void;
};

export function WeightSheet({
  visible,
  onClose,
  onSave,
}: WeightSheetProps) {
  const [value, setValue] = useState("");

  async function handleSave() {
    const weight = Number(value);

    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium,
    );

    onSave(weight);
    setValue("");
  }

  function handleClose() {
    setValue("");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
        />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Log weight</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close weight"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <X
                size={22}
                color={GymColors.text.secondary}
              />
            </Pressable>
          </View>

          <Text style={styles.label}>
            Weight
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="64.8"
              placeholderTextColor={
                GymColors.text.tertiary
              }
              keyboardType="decimal-pad"
              style={styles.input}
              autoFocus
            />

            <Text style={styles.unit}>kg</Text>
          </View>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save weight"
          >
            <Text style={styles.saveText}>
              Save weight
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },

  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
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
    fontWeight: "600",
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginBottom: Spacing.one,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },

  input: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: 28,
    paddingVertical: Spacing.three,
  },

  unit: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  saveButton: {
    marginTop: Spacing.three,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
