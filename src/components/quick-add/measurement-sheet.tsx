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

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  addMeasurement,
  getLatestMeasurement,
} from "@/storage/repositories/measurements";
import type {
  Measurement,
  MeasurementType,
  MeasurementUnit,
} from "@/types/gymos";
import { showToast } from "@/utils/toast";

type MeasurementOption = {
  type: MeasurementType;
  label: string;
  unit: MeasurementUnit;
};

const MEASUREMENTS: MeasurementOption[] = [
  {
    type: "biceps",
    label: "Biceps",
    unit: "in",
  },
  {
    type: "chest",
    label: "Chest",
    unit: "in",
  },
  {
    type: "waist",
    label: "Waist",
    unit: "in",
  },
  {
    type: "thigh",
    label: "Thigh",
    unit: "in",
  },
];

type MeasurementSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function MeasurementSheet({
  visible,
  onClose,
  onSaved,
}: MeasurementSheetProps) {
  const [selected, setSelected] = useState<MeasurementOption | null>(null);

  const [value, setValue] = useState("");

  const [latest, setLatest] = useState<Record<string, Measurement | undefined>>(
    {},
  );

  async function loadLatestMeasurements() {
    const entries = await Promise.all(
      MEASUREMENTS.map(async (measurement) => {
        const result = await getLatestMeasurement(measurement.type);

        return [measurement.type, result] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  useEffect(() => {
    if (!visible) {
      return;
    }

    loadLatestMeasurements()
      .then(setLatest)
      .catch(() => {
        // Fall back to no "previous" values on a read failure.
        setLatest({});
      });
  }, [visible]);

  function selectMeasurement(measurement: MeasurementOption) {
    setSelected(measurement);
    setValue("");
  }

  async function handleSave() {
    if (!selected) {
      return;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }

    try {
      const measurement = await addMeasurement(
        selected.type,
        numericValue,
        selected.unit,
      );

      setLatest((current) => ({
        ...current,
        [selected.type]: measurement,
      }));

      setSelected(null);
      setValue("");
      onSaved?.();
    } catch {
      showToast("Couldn't log measurement");
    }
  }

  function handleClose() {
    setSelected(null);
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {selected ? selected.label : "Measurements"}
            </Text>

            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close measurements"
            >
              <X size={22} color={GymColors.text.secondary} />
            </Pressable>
          </View>

          {!selected ? (
            <View style={styles.options}>
              {MEASUREMENTS.map((measurement) => {
                const entry = latest[measurement.type];

                return (
                  <Pressable
                    key={measurement.type}
                    style={styles.option}
                    onPress={() => selectMeasurement(measurement)}
                    accessibilityRole="button"
                    accessibilityLabel={`Track ${measurement.label}`}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionLabel}>
                        {measurement.label}
                      </Text>

                      {entry ? (
                        <Text style={styles.latestValue}>
                          {entry.value} {entry.unit}
                        </Text>
                      ) : (
                        <Text style={styles.optionUnit}>Not recorded</Text>
                      )}
                    </View>

                    <Text style={styles.optionArrow}>+</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View>
              <Text style={styles.previousLabel}>Previous</Text>

              <Text style={styles.previousValue}>
                {latest[selected.type]
                  ? `${latest[selected.type]?.value} ${selected.unit}`
                  : "No previous measurement"}
              </Text>

              <Text style={styles.inputLabel}>New measurement</Text>

              <View style={styles.inputRow}>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder="0.0"
                  placeholderTextColor={GymColors.text.tertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={styles.input}
                />

                <View style={styles.unitContainer}>
                  <Text style={styles.unitText}>{selected.unit}</Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.saveButton,
                  !value.trim() && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!value.trim()}
                accessibilityRole="button"
                accessibilityLabel="Save measurement"
              >
                <Text style={styles.saveButtonText}>Save measurement</Text>
              </Pressable>

              <Pressable
                style={styles.backButton}
                onPress={() => {
                  setSelected(null);
                  setValue("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Back to measurements"
              >
                <Text style={styles.backButtonText}>Back to measurements</Text>
              </Pressable>
            </View>
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

  options: {
    gap: Spacing.two,
  },

  option: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  optionContent: {
    flex: 1,
  },

  optionLabel: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  latestValue: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  optionUnit: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  optionArrow: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "500",
  },

  previousLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  previousValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  inputLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  inputRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  input: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    color: GymColors.text.primary,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: Typography.h2,
  },

  unitContainer: {
    width: 64,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },

  unitText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
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

  backButton: {
    marginTop: Spacing.two,
    alignItems: "center",
    paddingVertical: Spacing.two,
  },

  backButtonText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },
});
