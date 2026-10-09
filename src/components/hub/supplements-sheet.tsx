import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  addSupplement,
  getSupplements,
  removeSupplement,
  restoreSupplement,
  setSupplementEnabled,
  type Supplement,
} from "@/storage/repositories/supplements";
import { showToast, showUndoToast } from "@/utils/toast";

const QUICK_ADD = ["Creatine", "Whey", "Vitamin D", "Fish Oil"];

type SupplementsSheetProps = {
  onClose: () => void;
};

export function SupplementsSheet({ onClose }: SupplementsSheetProps) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getSupplements().then(setSupplements).catch(() => setSupplements([]));
  }, []);

  async function handleAdd(customName?: string) {
    if (adding) return;

    const value = (customName ?? name).trim();

    if (!value) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    setAdding(true);
    try {
      const supplement = await addSupplement(value);

      if (supplement) {
        setSupplements((current) => [...current, supplement]);
        setName("");
      }
    } catch {
      showToast("Couldn't save supplement");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(supplement: Supplement) {
    const enabled = !supplement.enabled;

    try {
      await setSupplementEnabled(supplement.id, enabled);

      setSupplements((current) =>
        current.map((s) =>
          s.id === supplement.id ? { ...s, enabled } : s,
        ),
      );
    } catch {
      showToast("Couldn't update supplement");
    }
  }

  async function handleRemove(id: string) {
    const target = supplements.find((s) => s.id === id);
    try {
      await removeSupplement(id);

      setSupplements((current) =>
        current.filter((s) => s.id !== id),
      );
      if (target) {
        showUndoToast({
          message: `${target.name} removed`,
          onUndo: async () => {
            await restoreSupplement(target);
            setSupplements(await getSupplements());
          },
        });
      }
    } catch {
      showToast("Couldn't remove supplement");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Supplements</Text>

          <Text style={styles.subtitle}>
            Config what you take, once.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close supplements"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.quickAdd}>
        {QUICK_ADD.map((item) => (
          <Pressable
            key={item}
            onPress={() => handleAdd(item)}
            style={styles.quickChip}
            accessibilityRole="button"
            accessibilityLabel={`Quick add ${item}`}
          >
            <Text style={styles.quickChipText}>+ {item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Or type one"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.nameInput}
          onSubmitEditing={() => handleAdd()}
        />

        <Pressable
          onPress={() => handleAdd()}
          disabled={adding}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add supplement"
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {supplements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No supplements configured yet.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {supplements.map((supplement) => (
            <View key={supplement.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowText}>
                  {supplement.name}
                </Text>

                <Pressable
                  onPress={() => handleToggle(supplement)}
                  style={[
                    styles.toggle,
                    supplement.enabled && styles.toggleOn,
                  ]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: supplement.enabled }}
                  accessibilityLabel={`Toggle ${supplement.name}`}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      supplement.enabled && styles.toggleTextOn,
                    ]}
                  >
                    {supplement.enabled ? "On" : "Off"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => handleRemove(supplement.id)}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${supplement.name}`}
              >
                <Text style={styles.deleteText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
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
    maxHeight: "75%",
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

  quickAdd: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  quickChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.card,
  },

  quickChipText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  addRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  nameInput: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  addButton: {
    width: 48,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: GymColors.background.primary,
    fontSize: 22,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: Spacing.five,
    alignItems: "center",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  list: {
    gap: Spacing.two,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },

  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },

  rowText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  toggle: {
    paddingHorizontal: Spacing.two,
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

  deleteButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    color: GymColors.text.secondary,
    fontSize: 24,
    fontWeight: "300",
  },
});