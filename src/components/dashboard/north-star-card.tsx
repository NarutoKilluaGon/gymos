import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
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

type NorthStarCardProps = {
  northStar: NorthStar;
  onNorthStarChange?: (northStar: NorthStar) => void;
};

export function NorthStarCard({
  northStar,
  onNorthStarChange,
}: NorthStarCardProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingChange, setConfirmingChange] = useState(false);

  const [title, setTitle] = useState(northStar.title);
  const [why, setWhy] = useState(northStar.why);

  useEffect(() => {
    setTitle(northStar.title);
    setWhy(northStar.why);
  }, [northStar]);

  function openEditor() {
    setOpen(false);
    setEditing(true);
  }

  function requestChange() {
    setEditing(false);
    setConfirmingChange(true);
  }

  async function save() {
    const updatedNorthStar: NorthStar = {
      title: title.trim(),
      why: why.trim(),
      lastChangedAt: new Date().toISOString(),
    };

    await saveNorthStar(updatedNorthStar);

    onNorthStarChange?.(updatedNorthStar);

    setConfirmingChange(false);
    setOpen(true);
  }

  function cancelChange() {
    setTitle(northStar.title);
    setWhy(northStar.why);
    setConfirmingChange(false);
    setEditing(false);
    setOpen(true);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open North Star"
      >
        <GymCard style={styles.card}>
          <Text style={styles.eyebrow}>NORTH STAR</Text>

          <Text style={styles.title}>{northStar.title}</Text>

          <View style={styles.whySection}>
            <Text style={styles.whyLabel}>WHY</Text>

            <Text style={styles.why}>{northStar.why}</Text>
          </View>
        </GymCard>
      </Pressable>

      {/* North Star details */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.sheetTitle}>North Star</Text>

              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close North Star"
              >
                <X size={22} color={GymColors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.goal}>{northStar.title}</Text>

            <View style={styles.whySection}>
              <Text style={styles.detailLabel}>Why</Text>

              <Text style={styles.why}>{northStar.why}</Text>
            </View>

            <Text style={styles.note}>
              Your North Star is your direction. It isn't something that needs
              to change every time your motivation changes.
            </Text>

            <Pressable style={styles.editButton} onPress={openEditor}>
              <Text style={styles.editButtonText}>Change North Star</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit North Star */}
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setEditing(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.sheetTitle}>Change North Star</Text>

              <Pressable
                onPress={() => setEditing(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close North Star editor"
              >
                <X size={22} color={GymColors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.warning}>
              This is your long-term direction. Change it deliberately, not
              impulsively.
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
              style={styles.saveButton}
              onPress={requestChange}
              disabled={!title.trim() || !why.trim()}
            >
              <Text style={styles.saveButtonText}>Continue</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change confirmation */}
      <Modal
        visible={confirmingChange}
        transparent
        animationType="fade"
        onRequestClose={cancelChange}
      >
        <View style={styles.confirmModal}>
          <Pressable style={styles.backdrop} onPress={cancelChange} />

          <View style={styles.confirmCard}>
            <Text style={styles.confirmEyebrow}>CHANGE NORTH STAR</Text>

            <Text style={styles.confirmTitle}>Are you sure?</Text>

            <Text style={styles.confirmText}>
              Your North Star is supposed to provide direction when motivation
              changes. Don't replace it just because today feels different.
            </Text>

            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelButton} onPress={cancelChange}>
                <Text style={styles.cancelButtonText}>Keep it</Text>
              </Pressable>

              <Pressable style={styles.confirmButton} onPress={save}>
                <Text style={styles.confirmButtonText}>Change it</Text>
              </Pressable>
            </View>
          </View>
        </View>
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

  whySection: {
    marginTop: Spacing.three,
  },

  whyLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  why: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
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

  goal: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
  },

  detailLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.one,
  },

  note: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    lineHeight: 19,
    marginTop: Spacing.four,
  },

  editButton: {
    marginTop: Spacing.four,
    backgroundColor: GymColors.semantic.accent,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    alignItems: "center",
  },

  editButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
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

  saveButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  confirmModal: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },

  confirmCard: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.extraLarge,
    padding: Spacing.four,
  },

  confirmEyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.two,
  },

  confirmTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
  },

  confirmText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
    marginTop: Spacing.two,
  },

  confirmActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.four,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    alignItems: "center",
  },

  cancelButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  confirmButton: {
    flex: 1,
    backgroundColor: GymColors.semantic.accent,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    alignItems: "center",
  },

  confirmButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
