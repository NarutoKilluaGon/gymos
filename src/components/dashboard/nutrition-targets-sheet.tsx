import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  ACTIVITY_LEVELS,
  estimateMaintenanceCalories,
} from "@/services/calorie-target";
import {
  getNutritionProfile,
  saveNutritionProfile,
  type ActivityLevel,
  type ProfileSex,
} from "@/storage/repositories/nutrition-profile";
import {
  getNutritionTargets,
  saveNutritionTargets,
  type CalorieGoal,
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
  // S7: maintenance + goal drive the calculated daily target. Empty
  // maintenance keeps the static Calories target behavior unchanged.
  const [maintenance, setMaintenance] = useState("");
  const [goal, setGoal] = useState<CalorieGoal>("maintain");
  const [adjustment, setAdjustment] = useState("");
  // Maintenance-calculator inputs. Persisted alongside the targets so a
  // later edit recalculates from the same profile.
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<ProfileSex | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] =
    useState<ActivityLevel | null>(null);

  useEffect(() => {
    if (!visible) return;

    getNutritionTargets().then((targets) => {
      setCalories(targets.calories !== undefined ? String(targets.calories) : "");
      setProtein(targets.protein !== undefined ? String(targets.protein) : "");
      setCarbs(targets.carbs !== undefined ? String(targets.carbs) : "");
      setFat(targets.fat !== undefined ? String(targets.fat) : "");
      setMaintenance(
        targets.maintenanceCalories !== undefined
          ? String(targets.maintenanceCalories)
          : "",
      );
      setGoal(targets.calorieGoal ?? "maintain");
      setAdjustment(
        targets.goalAdjustmentKcal !== undefined
          ? String(targets.goalAdjustmentKcal)
          : "",
      );
    });

    getNutritionProfile().then((profile) => {
      setAge(
        profile.ageYears !== undefined ? String(profile.ageYears) : "",
      );
      setSex(profile.sex ?? null);
      setHeightCm(
        profile.heightCm !== undefined ? String(profile.heightCm) : "",
      );
      setWeightKg(
        profile.weightKg !== undefined ? String(profile.weightKg) : "",
      );
      setActivityLevel(profile.activityLevel ?? null);
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

  function parseProfileNumber(value: string): number | undefined {
    if (!value.trim()) return undefined;

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  /** Fill the Maintenance field from the calculator profile. The value
   *  only applies once the sheet is saved, like every other field. */
  async function handleCalculateMaintenance() {
    const estimated = estimateMaintenanceCalories({
      ageYears: parseProfileNumber(age),
      sex,
      heightCm: parseProfileNumber(heightCm),
      weightKg: parseProfileNumber(weightKg),
      activityLevel,
    });

    if (estimated === null) {
      showToast("Enter age, sex, height, weight, and activity first");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMaintenance(String(estimated));
    showToast(`Estimated maintenance ~${estimated} kcal — save to apply`);
  }

  async function handleSave() {
    const targets = {
      calories: parseOptional(calories),
      protein: parseOptional(protein),
      carbs: parseOptional(carbs),
      fat: parseOptional(fat),
      maintenanceCalories: parseOptional(maintenance),
      calorieGoal: goal,
      goalAdjustmentKcal: parseOptional(adjustment),
    };

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await saveNutritionTargets(targets);
      await saveNutritionProfile({
        ageYears: parseProfileNumber(age),
        sex: sex ?? undefined,
        heightCm: parseProfileNumber(heightCm),
        weightKg: parseProfileNumber(weightKg),
        activityLevel: activityLevel ?? undefined,
      });
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
          <TargetField
            label="Calories"
            value={calories}
            onChange={setCalories}
            unit="kcal"
            placeholder="2200"
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Maintenance</Text>

            <View style={styles.inputRow}>
              <TextInput
                value={maintenance}
                onChangeText={setMaintenance}
                placeholder="2200"
                placeholderTextColor={GymColors.text.tertiary}
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={styles.inputUnit}>kcal</Text>
            </View>

            <Text style={styles.fieldHint}>
              Base daily burn. Set it to switch the Nutrition target from
              the fixed Calories value above to a calculated one.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Maintenance calculator
            </Text>

            <View style={styles.calcRow}>
              <View style={styles.calcField}>
                <Text style={styles.fieldLabel}>Age</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={age}
                    onChangeText={setAge}
                    placeholder="30"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="number-pad"
                    style={styles.input}
                    accessibilityLabel="Age in years"
                  />
                </View>
              </View>

              <View style={styles.calcField}>
                <Text style={styles.fieldLabel}>Sex</Text>

                <View style={styles.goalRow}>
                  {(
                    [
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ] as const
                  ).map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setSex(option.value)}
                      style={[
                        styles.goalOption,
                        sex === option.value &&
                          styles.goalOptionSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: sex === option.value,
                      }}
                      accessibilityLabel={`${option.label}`}
                    >
                      <Text
                        style={[
                          styles.goalOptionText,
                          sex === option.value &&
                            styles.goalOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.calcRow}>
              <View style={styles.calcField}>
                <Text style={styles.fieldLabel}>Height (cm)</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="175"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="decimal-pad"
                    style={styles.input}
                    accessibilityLabel="Height in centimeters"
                  />
                </View>
              </View>

              <View style={styles.calcField}>
                <Text style={styles.fieldLabel}>Weight (kg)</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="70"
                    placeholderTextColor={
                      GymColors.text.tertiary
                    }
                    keyboardType="decimal-pad"
                    style={styles.input}
                    accessibilityLabel="Weight in kilograms"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Daily activity</Text>

            <View style={styles.activityGrid}>
              {ACTIVITY_LEVELS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setActivityLevel(option.value)}
                  style={[
                    styles.activityOption,
                    activityLevel === option.value &&
                      styles.goalOptionSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: activityLevel === option.value,
                  }}
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      activityLevel === option.value &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>

                  <Text
                    style={[
                      styles.activityBlurb,
                      activityLevel === option.value &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {option.blurb}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleCalculateMaintenance}
              style={styles.calcButton}
              accessibilityRole="button"
              accessibilityLabel="Calculate maintenance from profile"
            >
              <Text style={styles.calcButtonText}>
                Calculate maintenance
              </Text>
            </Pressable>

            <Text style={styles.fieldHint}>
              Maintenance is an estimate, not a measurement. Activity
              covers everyday life outside logged training — logged
              workouts and cardio are added on top.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Goal</Text>

            <View style={styles.goalRow}>
              {(
                [
                  { value: "deficit", label: "Deficit" },
                  { value: "maintain", label: "Maintain" },
                  { value: "surplus", label: "Surplus" },
                ] as const
              ).map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setGoal(option.value)}
                  style={[
                    styles.goalOption,
                    goal === option.value &&
                      styles.goalOptionSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: goal === option.value,
                  }}
                  accessibilityLabel={`${option.label} goal`}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      goal === option.value &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldHint}>
              Today&apos;s target = maintenance + training estimate ±
              goal.
            </Text>
          </View>

          <TargetField
            label="Adjustment"
            value={adjustment}
            onChange={setAdjustment}
            unit="kcal"
            placeholder="500"
            hint="Above maintenance on Surplus, below it on Deficit. Maintain ignores it."
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
          </ScrollView>
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
  hint?: string;
};

function TargetField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  hint,
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

      {hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
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

  scroll: {
    flexGrow: 0,
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

  fieldHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  goalRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  goalOption: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  goalOptionSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  goalOptionText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  goalOptionTextSelected: {
    color: GymColors.background.primary,
  },

  calcRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },

  calcField: {
    flex: 1,
  },

  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  activityOption: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
    gap: Spacing.half,
  },

  activityBlurb: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    textAlign: "center",
  },

  calcButton: {
    marginTop: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },

  calcButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
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