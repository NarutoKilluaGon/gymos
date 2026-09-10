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

export type SleepInput = {
  hours: number;
  minutes: number;
};

type SleepSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (sleep: SleepInput) => void;
};

export function SleepSheet({
  visible,
  onClose,
  onSave,
}: SleepSheetProps) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");

  async function handleSave() {
    const hoursValue = Number(hours);
    const minutesValue = Number(
      minutes === "" ? 0 : minutes,
    );

    const validHours =
      Number.isFinite(hoursValue) &&
      hoursValue >= 0 &&
      hoursValue <= 24;

    const validMinutes =
      Number.isFinite(minutesValue) &&
      minutesValue >= 0 &&
      minutesValue < 60;

    const hasDuration = hoursValue > 0 || minutesValue > 0;

    if (
      !validHours ||
      !validMinutes ||
      !hasDuration
    ) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    onSave({ hours: hoursValue, minutes: minutesValue });

    setHours("");
    setMinutes("");
  }

  function handleClose() {
    setHours("");
    setMinutes("");
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
            <Text style={styles.title}>
              Log sleep
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sleep"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <X
                size={22}
                color={GymColors.text.secondary}
              />
            </Pressable>
          </View>

          <Text style={styles.hint}>
            How long did you sleep?
          </Text>

          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <View style={styles.inputRow}>
                <TextInput
                  value={hours}
                  onChangeText={setHours}
                  placeholder="7"
                  placeholderTextColor={
                    GymColors.text.tertiary
                  }
                  keyboardType="number-pad"
                  style={styles.input}
                  autoFocus
                />

                <Text style={styles.unit}>hrs</Text>
              </View>
            </View>

            <View style={styles.durationField}>
              <View style={styles.inputRow}>
                <TextInput
                  value={minutes}
                  onChangeText={setMinutes}
                  placeholder="30"
                  placeholderTextColor={
                    GymColors.text.tertiary
                  }
                  keyboardType="number-pad"
                  style={styles.input}
                />

                <Text style={styles.unit}>min</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save sleep"
          >
            <Text style={styles.saveText}>
              Save sleep
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

  hint: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginBottom: Spacing.three,
  },

  durationRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },

  durationField: {
    flex: 1,
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