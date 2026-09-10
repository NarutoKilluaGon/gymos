import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { Supplement } from "@/storage/repositories/supplements";
import { getSupplements } from "@/storage/repositories/supplements";
import {
  getSupplementLogsForDate,
  setSupplementTaken,
} from "@/storage/repositories/supplement-logs";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

type SupplementLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function SupplementLogSheet({
  visible,
  onClose,
  onChanged,
}: SupplementLogSheetProps) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [taken, setTaken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) return;

    async function load() {
      const [list, logs] = await Promise.all([
        getSupplements(),
        getSupplementLogsForDate(getTodayKey()),
      ]);

      setSupplements(list.filter((s) => s.enabled));
      setTaken(logs);
    }

    load();
  }, [visible]);

  async function handleToggle(supplementId: string) {
    const next = !taken[supplementId];

    setTaken((current) => ({
      ...current,
      [supplementId]: next,
    }));

    try {
      await setSupplementTaken(getTodayKey(), supplementId, next);
      onChanged();
    } catch {
      // Revert the optimistic toggle on failure.
      setTaken((current) => ({
        ...current,
        [supplementId]: !next,
      }));
      showToast("Couldn't log supplement");
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Supplements</Text>

              <Text style={styles.subtitle}>
                Tap each one you have taken today.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close supplements"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={22} color={GymColors.text.secondary} />
            </Pressable>
          </View>

          {supplements.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No supplements yet
              </Text>

              <Text style={styles.emptyText}>
                Add what you take in the Hub, and it will appear
                here to log each day.
              </Text>

              <Pressable
                onPress={() => {
                  onClose();
                  router.push("/hub");
                }}
                style={styles.emptyButton}
                accessibilityRole="button"
                accessibilityLabel="Go to Hub"
              >
                <Text style={styles.emptyButtonText}>
                  Go to Hub
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {supplements.map((supplement) => (
                <View key={supplement.id} style={styles.row}>
                  <Text style={styles.rowText}>
                    {supplement.name}
                  </Text>

                  <Pressable
                    onPress={() => handleToggle(supplement.id)}
                    style={[
                      styles.toggle,
                      taken[supplement.id] && styles.toggleOn,
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !!taken[supplement.id] }}
                    accessibilityLabel={`Toggle ${supplement.name}`}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        taken[supplement.id] && styles.toggleTextOn,
                      ]}
                    >
                      {taken[supplement.id] ? "Taken" : "Not taken"}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
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
    maxHeight: "75%",
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

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    alignItems: "center",
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "600",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
    marginBottom: Spacing.one,
  },

  emptyButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  emptyButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  scroll: {
    flexGrow: 0,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },

  rowText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  toggle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
  },

  toggleOn: {
    backgroundColor: GymColors.semantic.success,
  },

  toggleText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  toggleTextOn: {
    color: GymColors.background.primary,
  },
});