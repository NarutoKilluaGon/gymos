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
import type { JournalEntry } from "@/types/gymos";

const MAX_CHARS = 500;

const MOODS: { value: JournalEntry["mood"]; label: string; emoji: string }[] = [
  { value: "great", label: "Great", emoji: "😄" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "tired", label: "Tired", emoji: "😴" },
  { value: "rough", label: "Rough", emoji: "😞" },
];

type JournalSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (text: string, mood?: JournalEntry["mood"]) => void;
};

export function JournalSheet({
  visible,
  onClose,
  onSave,
}: JournalSheetProps) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState<JournalEntry["mood"]>("okay");

  async function handleSave() {
    const trimmed = text.trim();

    if (!trimmed) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    onSave(trimmed, mood);
    setText("");
    setMood("okay");
  }

  function handleClose() {
    setText("");
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
              Journal entry
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close journal"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <X
                size={22}
                color={GymColors.text.secondary}
              />
            </Pressable>
          </View>

          <TextInput
            value={text}
            onChangeText={(value) =>
              setText(value.slice(0, MAX_CHARS))
            }
            placeholder="How was the session?"
            placeholderTextColor={
              GymColors.text.tertiary
            }
            multiline
            maxLength={MAX_CHARS}
            textAlignVertical="top"
            style={styles.input}
            autoFocus
          />

          <View style={styles.moodSection}>
            <Text style={styles.moodLabel}>How did it feel?</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => setMood(m.value)}
                  style={[
                    styles.moodButton,
                    mood === m.value && styles.moodButtonSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: mood === m.value }}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={styles.moodText}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.counter}>
            {text.length} / {MAX_CHARS}
          </Text>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save entry"
          >
            <Text style={styles.saveText}>
              Save entry
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
    marginBottom: Spacing.three,
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

  input: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    minHeight: 120,
  },

  counter: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "right",
    marginTop: Spacing.one,
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

  moodSection: {
    marginTop: Spacing.three,
  },

  moodLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.two,
  },

  moodRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  moodButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderWidth: 2,
    borderColor: GymColors.background.surface,
  },

  moodButtonSelected: {
    borderColor: GymColors.semantic.accent,
    backgroundColor: GymColors.semantic.accent + "15",
  },

  moodEmoji: {
    fontSize: 24,
    marginBottom: Spacing.one,
  },

  moodText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "500",
  },
});