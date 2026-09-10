import * as Haptics from "expo-haptics";
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
import { X } from "lucide-react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  getNutritionTargets,
  saveNutritionTargets,
} from "@/storage/repositories/nutrition-targets";
import { showToast } from "@/utils/toast";

type NutritionTargetsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function NutritionTargetsSheet({
  visible,
  onClose,
  onSaved,
}: NutritionTargetsSheetProps) {
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!visible) return;

    getNutritionTargets().then((targets) => {
      setCalories(targets.calories !== undefined ? String(targets.calories) : "");
      setProtein(targets.protein !== undefined ? String(targets.protein) : "");
      setCarbs(targets.carbs !== undefined ? String(targets.carbs) : "");
      setFat(targets.fat !== undefined ? String(targets.fat) : "");
    });
  }, [visible]);

  function parseOptional(value: string): number | undefined {
    if (!value.trim()) return undefined;

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  async function handleClear() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await saveNutritionTargets({});
      onSaved();
      onClose();
    } catch {
      showToast("Couldn't clear targets");
    }
  }

  async function handleSave() {
    const targets = {
      calories: parseOptional(calories),
      protein: parseOptional(protein),
      carbs: parseOptional(carbs),
      fat: parseOptional(fat),
    };

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await saveNutritionTargets(targets);
      onSaved();
      onClose();
    } catch {
      showToast("Couldn't save targets");
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
              <Text style={styles.title}>Daily targets</Text>

              <Text style={styles.subtitle}>
                Leave a field empty to not track it.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close targets"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={22} color={GymColors.text.secondary} />
            </Pressable>
          </View>

          <TargetField
            label="Calories"
            value={calories}
            onChange={setCalories}
            unit="kcal"
            placeholder="2200"
          />

          <TargetField
            label="Protein"
            value={protein}
            onChange={setProtein}
            unit="g"
            placeholder="160"
          />

          <TargetField
            label="Carbs"
            value={carbs}
            onChange={setCarbs}
            unit="g"
            placeholder="220"
          />

          <TargetField
            label="Fat"
            value={fat}
            onChange={setFat}
            unit="g"
            placeholder="70"
          />

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save targets"
          >
            <Text style={styles.saveText}>Save targets</Text>
          </Pressable>

          <Pressable
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear all targets"
          >
            <Text style={styles.clearText}>Clear all targets</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type TargetFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  placeholder: string;
};

function TargetField({
  label,
  value,
  onChange,
  unit,
  placeholder,
}: TargetFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={GymColors.text.tertiary}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
    </View>
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

  field: {
    marginBottom: Spacing.three,
  },

  fieldLabel: {
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
    fontSize: Typography.body,
    paddingVertical: Spacing.three,
  },

  inputUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  saveButton: {
    marginTop: Spacing.one,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  clearButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  clearText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
});