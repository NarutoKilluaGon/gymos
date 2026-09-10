import { X } from "lucide-react-native";
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

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { saveNorthStar } from "@/storage/repositories/north-star";
import type { NorthStar } from "@/types/gymos";
import { showToast } from "@/utils/toast";

type NorthStarSetupCardProps = {
  onCreated: (northStar: NorthStar) => void;
};

export function NorthStarSetupCard({
  onCreated,
}: NorthStarSetupCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (saving || !title.trim() || !why.trim()) {
      return;
    }

    setSaving(true);

    try {
      const northStar: NorthStar = {
        title: title.trim(),
        why: why.trim(),
        lastChangedAt: new Date().toISOString(),
      };

      await saveNorthStar(northStar);

      onCreated(northStar);
      setOpen(false);
      showToast("North Star set", "success");
    } catch {
      showToast("Couldn't save North Star");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <GymCard style={styles.card}>
        <Text style={styles.eyebrow}>NORTH STAR</Text>

        <Text style={styles.title}>Set your North Star</Text>

        <Text style={styles.message}>
          Define the direction every decision pulls toward.
        </Text>

        <Pressable
          onPress={() => setOpen(true)}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Set your North Star"
        >
          <Text style={styles.buttonText}>Set your North Star</Text>
        </Pressable>
      </GymCard>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.sheetTitle}>Set your North Star</Text>

              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close North Star setup"
              >
                <X size={22} color={GymColors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.warning}>
              This becomes your long-term direction. Keep it a goal you work
              toward deliberately, not something that changes with the day.
            </Text>

            <Text style={styles.inputLabel}>What are you working toward?</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Your North Star"
              placeholderTextColor={GymColors.text.tertiary}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Why does this matter?</Text>

            <TextInput
              value={why}
              onChangeText={setWhy}
              placeholder="Why are you pursuing this?"
              placeholderTextColor={GymColors.text.tertiary}
              multiline
              style={[styles.input, styles.whyInput]}
            />

            <Pressable
              onPress={handleCreate}
              disabled={saving || !title.trim() || !why.trim()}
              style={[
                styles.saveButton,
                (saving || !title.trim() || !why.trim()) &&
                  styles.saveButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save North Star"
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Set North Star"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },

  message: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
    marginTop: Spacing.one,
  },

  button: {
    marginTop: Spacing.three,
    alignSelf: "flex-start",
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  buttonText: {
    color: GymColors.background.primary,
    fontSize: Typography.caption,
    fontWeight: "700",
  },

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

  sheetTitle: {
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

  warning: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },

  inputLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },

  input: {
    backgroundColor: GymColors.background.card,
    color: GymColors.text.primary,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: Typography.body,
  },

  whyInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  saveButton: {
    marginTop: Spacing.four,
    backgroundColor: GymColors.semantic.accent,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});