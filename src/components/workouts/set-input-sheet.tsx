import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { PersonalRecord, WorkoutSet, WorkoutExercise } from "@/types/gymos";

type ReferenceData = {
  previousSet?: WorkoutSet;
  pr?: PersonalRecord | null;
};

type SetInputSheetProps = {
  exercise: WorkoutExercise;
  weight: string;
  reps: string;
  saving: boolean;
  reference?: ReferenceData;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function SetInputSheet({
  exercise,
  weight,
  reps,
  saving,
  reference,
  onWeightChange,
  onRepsChange,
  onSave,
  onClose,
}: SetInputSheetProps) {
  const prevSet = reference?.previousSet;
  const pr = reference?.pr;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Add Set</Text>

          <Text style={styles.subtitle}>{exercise.name}</Text>
        </View>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close set input"
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {(prevSet || pr) && (
        <View style={styles.reference}>
          {prevSet ? (
            <Text style={styles.referenceText}>
              Last: {prevSet.weight ?? "?"} kg × {prevSet.reps} reps
            </Text>
          ) : (
            <Text style={styles.referenceEmpty}>First set for this exercise</Text>
          )}

          {pr ? (
            <Text style={styles.referencePr}>
              PR: {pr.weight} kg × {pr.reps} reps
            </Text>
          ) : (
            !prevSet && <Text style={styles.referenceEmpty}>No PR yet</Text>
          )}
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Weight</Text>

        <View style={styles.inputRow}>
          <TextInput
            value={weight}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={GymColors.text.tertiary}
            style={styles.input}
          />

          <Text style={styles.inputUnit}>kg</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Reps</Text>

        <TextInput
          value={reps}
          onChangeText={onRepsChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.input}
        />
      </View>

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={[
          styles.saveButton,
          saving && styles.saveButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Save set"
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Set"}
        </Text>
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

  reference: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    marginBottom: Spacing.three,
    gap: 4,
  },

  referenceText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  referencePr: {
    color: GymColors.semantic.accent,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  referenceEmpty: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontStyle: "italic",
  },

  inputGroup: {
    marginBottom: Spacing.three,
  },

  inputLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  inputUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginLeft: Spacing.two,
  },

  saveButton: {
    marginTop: Spacing.one,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});
