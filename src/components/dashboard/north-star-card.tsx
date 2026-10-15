import { Star, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { saveNorthStar } from "@/storage/repositories/north-star";
import { convertWeight } from "@/storage/repositories/preferences";
import { showToast } from "@/utils/toast";
import { useReducedMotion } from "@/utils/motion";
import type {
  GoalType,
  MeasurementType,
  MeasurementUnit,
  NorthStar,
} from "@/types/gymos";

const STATIC_STARS = [
  { id: "s1", top: 16, left: 24, size: 2, opacity: 0.5 },
  { id: "s2", top: 38, left: 120, size: 1.5, opacity: 0.6 },
  { id: "s3", top: 22, right: 90, size: 2, opacity: 0.45 },
  { id: "s4", top: 65, left: 45, size: 2.5, opacity: 0.7 },
  { id: "s5", top: 78, right: 65, size: 1.5, opacity: 0.5 },
  { id: "s6", bottom: 35, left: 140, size: 2, opacity: 0.5 },
  { id: "s7", bottom: 20, left: 55, size: 1.5, opacity: 0.6 },
  { id: "s8", bottom: 26, right: 110, size: 2.5, opacity: 0.55 },
];

function ShootingStar() {
  const reducedMotion = useReducedMotion();
  const slideAnim = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, slideAnim]);

  const animatedStyle = {
    opacity: slideAnim,
    transform: [
      {
        translateX: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-13, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shootingStarContainer, animatedStyle]}
    >
      {/* Tail: ~130dp long, 2dp thick, rotated about -24 degrees running down-left from head */}
      <View style={styles.tailWrapper}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0)", "#FFFFFF"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.tail}
        />
      </View>

      {/* Head: ~8dp white dot with soft gold/lavender glow placed 30dp from right, 52dp from top */}
      <View style={styles.headGlowOuter} />
      <View style={styles.headGlowInner} />
      <View style={styles.headDot} />
    </Animated.View>
  );
}

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "gainMuscle", label: "Gain muscle" },
  { value: "loseWeight", label: "Lose weight" },
  { value: "buildStrength", label: "Build strength" },
  { value: "maintainWeight", label: "Maintain weight" },
  { value: "improveEndurance", label: "Improve endurance" },
];

// bodyFat is intentionally excluded — there is no logging UI for it, so a
// body-fat goal could never show progress.
const GOAL_METRICS: { value: MeasurementType; label: string }[] = [
  { value: "weight", label: "Weight" },
  { value: "biceps", label: "Biceps" },
  { value: "chest", label: "Chest" },
  { value: "waist", label: "Waist" },
  { value: "thigh", label: "Thigh" },
];

function unitForMetric(
  metric: MeasurementType,
  weightUnit: MeasurementUnit,
): MeasurementUnit {
  return metric === "weight" ? weightUnit : "in";
}

function goalDraftValid(
  goalEnabled: boolean,
  goalType: GoalType | null,
  metric: MeasurementType | null,
  targetValue: string,
): boolean {
  if (!goalEnabled) {
    return true;
  }

  if (goalType === null || metric === null) {
    return false;
  }

  const numeric = Number(targetValue);

  return Number.isFinite(numeric) && numeric > 0;
}

type NorthStarCardProps = {
  northStar: NorthStar;
  onNorthStarChange?: (northStar: NorthStar) => void;
};

export function NorthStarCard({
  northStar,
  onNorthStarChange,
}: NorthStarCardProps) {
  const { unit: weightUnit } = useWeightUnit();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingChange, setConfirmingChange] = useState(false);

  const [title, setTitle] = useState(northStar.title);
  const [why, setWhy] = useState(northStar.why);

  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [metric, setMetric] = useState<MeasurementType | null>(null);
  const [targetValue, setTargetValue] = useState("");

  function seedGoalDraft() {
    const hasGoal =
      northStar.metric !== undefined &&
      northStar.targetValue !== undefined &&
      northStar.unit !== undefined;

    setGoalEnabled(hasGoal);
    setGoalType(northStar.goalType ?? null);
    setMetric(northStar.metric ?? null);
    if (northStar.targetValue !== undefined) {
      // Weight goals: seed the editor with the stored target converted
      // into the selected unit so the value agrees with the form's unit
      // label. Non-weight goals (inches, %) are unit-stable passthroughs.
      // The stored target itself is only rewritten on save.
      const asSelected =
        northStar.unit === "kg" || northStar.unit === "lb"
          ? convertWeight(northStar.targetValue, northStar.unit, weightUnit)
          : northStar.targetValue;

      setTargetValue(
        asSelected === northStar.targetValue
          ? String(northStar.targetValue)
          : String(Math.round(asSelected * 10) / 10),
      );
    } else {
      setTargetValue("");
    }
  }

  function openEditor() {
    setTitle(northStar.title);
    setWhy(northStar.why);
    seedGoalDraft();
    setOpen(false);
    setEditing(true);
  }

  function requestChange() {
    setEditing(false);
    setConfirmingChange(true);
  }

  async function save() {
    const updatedNorthStar: NorthStar = {
      // Spread-and-override: preserves the measurable goal fields when the
      // user only changes the title/why. Building a fresh object here would
      // silently drop them.
      ...northStar,
      title: title.trim(),
      why: why.trim(),
      lastChangedAt: new Date().toISOString(),
    };

    const hasGoal =
      goalEnabled &&
      goalType !== null &&
      metric !== null &&
      goalDraftValid(
        goalEnabled,
        goalType,
        metric,
        targetValue,
      );

    if (hasGoal) {
      updatedNorthStar.goalType = goalType;
      updatedNorthStar.metric = metric;
      updatedNorthStar.targetValue = Number(targetValue);
      updatedNorthStar.unit = unitForMetric(metric, weightUnit);
    } else {
      delete updatedNorthStar.goalType;
      delete updatedNorthStar.metric;
      delete updatedNorthStar.targetValue;
      delete updatedNorthStar.unit;
    }

    try {
      await saveNorthStar(updatedNorthStar);

      onNorthStarChange?.(updatedNorthStar);

      setConfirmingChange(false);
      setOpen(true);
    } catch {
      showToast("Couldn't save North Star");
    }
  }

  function cancelChange() {
    setTitle(northStar.title);
    setWhy(northStar.why);
    seedGoalDraft();
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
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={["#171a4a", "#241552", "#3a1b5e"]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.card}
          >
            {STATIC_STARS.map((star) => (
              <View
                key={star.id}
                testID="static-star-dot"
                pointerEvents="none"
                style={[
                  styles.starDot,
                  {
                    top: star.top,
                    bottom: star.bottom,
                    left: star.left,
                    right: star.right,
                    width: star.size,
                    height: star.size,
                    borderRadius: star.size / 2,
                    opacity: star.opacity,
                  },
                ]}
              />
            ))}
            <ShootingStar />

            <View style={styles.content}>
              <View style={styles.headerRow}>
                <View style={styles.eyebrowRow}>
                  <Star size={12} color="#f2c46d" fill="#f2c46d" />
                  <Text style={styles.eyebrow}>NORTH STAR</Text>
                </View>
                <Pressable
                  onPress={openEditor}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit North Star"
                  style={styles.editButtonSmall}
                >
                  <Text style={styles.editButtonSmallText}>Edit</Text>
                </Pressable>
              </View>

              <Text style={styles.title}>{northStar.title}</Text>

              <View style={styles.whySection}>
                <Text style={styles.whyLabel}>WHY</Text>

                <Text style={styles.why}>{northStar.why}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
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
              Your North Star is your direction. It isn&apos;t something that needs
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
              style={styles.toggleRow}
              onPress={() => setGoalEnabled(!goalEnabled)}
              accessibilityRole="switch"
              accessibilityState={{ checked: goalEnabled }}
            >
              <View>
                <Text style={styles.toggleLabel}>
                  Make it measurable
                </Text>

                <Text style={styles.toggleHint}>
                  Track progress toward a target value
                </Text>
              </View>

              <View
                style={[
                  styles.toggleTrack,
                  goalEnabled && styles.toggleTrackOn,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    goalEnabled && styles.toggleThumbOn,
                  ]}
                />
              </View>
            </Pressable>

            {goalEnabled ? (
              <View style={styles.goalFields}>
                <Text style={styles.fieldLabel}>Goal type</Text>

                <View style={styles.chipWrap}>
                  {GOAL_TYPES.map((option) => {
                    const selected = option.value === goalType;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setGoalType(option.value)}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Metric</Text>

                <View style={styles.chipWrap}>
                  {GOAL_METRICS.map((option) => {
                    const selected = option.value === metric;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setMetric(option.value)}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Target value</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={targetValue}
                    onChangeText={setTargetValue}
                    placeholder="0.0"
                    placeholderTextColor={GymColors.text.tertiary}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.targetInput]}
                  />

                  <View style={styles.unitContainer}>
                    <Text style={styles.unitText}>
                      {metric !== null
                        ? unitForMetric(metric, weightUnit)
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Pressable
              style={styles.saveButton}
              onPress={requestChange}
              disabled={
                !title.trim() ||
                !why.trim() ||
                !goalDraftValid(
                  goalEnabled,
                  goalType,
                  metric,
                  targetValue,
                )
              }
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
              changes. Don&apos;t replace it just because today feels different.
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
  cardContainer: {
    borderRadius: Radius.large,
    overflow: "hidden",
    marginBottom: Spacing.two,
  },

  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    overflow: "hidden",
    position: "relative",
  },

  starDot: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },

  content: {
    position: "relative",
    zIndex: 1,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.one,
  },

  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  editButtonSmall: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  editButtonSmallText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  eyebrow: {
    color: "rgba(242, 196, 109, 0.85)",
    fontSize: Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  title: {
    color: "#FFFFFF",
    fontSize: Typography.h2,
    fontWeight: "600",
    paddingRight: 60,
  },

  whySection: {
    marginTop: Spacing.three,
  },

  whyLabel: {
    color: "#f2c46d",
    fontSize: Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: Spacing.one,
  },

  why: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: Typography.body,
    lineHeight: 22,
  },

  shootingStarContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    zIndex: 0,
  },

  tailWrapper: {
    position: "absolute",
    top: 55,
    right: 34,
    width: 130,
    height: 2,
    transformOrigin: "right center",
    transform: [{ rotate: "-24deg" }],
  },

  tail: {
    width: 130,
    height: 2,
    borderRadius: 1,
  },

  headGlowOuter: {
    position: "absolute",
    top: 45,
    right: 23,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#b9a3ff",
    opacity: 0.4,
  },

  headGlowInner: {
    position: "absolute",
    top: 49,
    right: 27,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#f2c46d",
    opacity: 0.6,
  },

  headDot: {
    position: "absolute",
    top: 52,
    right: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#f2c46d",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
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

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.three,
  },

  toggleLabel: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  toggleHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: GymColors.background.surface,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
  },

  toggleTrackOn: {
    backgroundColor: GymColors.semantic.accent,
    justifyContent: "flex-end",
  },

  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GymColors.text.secondary,
  },

  toggleThumbOn: {
    backgroundColor: "#FFFFFF",
  },

  goalFields: {
    marginTop: Spacing.two,
  },

  fieldLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
    marginTop: Spacing.three,
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.card,
  },

  chipSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  chipText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  chipTextSelected: {
    color: GymColors.text.primary,
  },

  inputRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  targetInput: {
    flex: 1,
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
