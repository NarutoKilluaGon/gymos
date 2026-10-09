import {
  Calendar,
  ChevronLeft,
  Dumbbell,
  Flame,
  Minus,
  Plus,
  TrendingUp,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ds/card";
import { CountUp } from "@/components/ds/count-up";
import { PressableScale } from "@/components/ds/pressable-scale";
import { Font, Metric, Radius, Space, Type } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { hapticSuccess } from "@/utils/haptics";
import { buildCatalog } from "@/services/forge/catalog";
import { planFromTemplate } from "@/services/forge/plan";
import {
  calculateTargets,
  type ActivityLevel,
  type BodyProfile,
  type OnboardingGoal,
  type Sex,
} from "@/services/onboarding/targets";
import {
  getCustomExercises,
  updateForgeSettings,
} from "@/storage/repositories/forge-settings";
import { saveNorthStar } from "@/storage/repositories/north-star";
import { saveNourishSettings } from "@/storage/repositories/nourish-settings";
import { setOnboardingComplete } from "@/storage/repositories/onboarding";
import { setWeightUnit } from "@/storage/repositories/preferences";
import type { NorthStar } from "@/types/gymos";
import { showToast } from "@/utils/toast";

type Props = {
  onDone: () => void;
};

const TOTAL_STEPS = 5;

type GoalOption = {
  id: OnboardingGoal;
  label: string;
  description: string;
  icon: typeof Dumbbell;
};

const GOALS: GoalOption[] = [
  {
    id: "buildMuscle",
    label: "Build muscle",
    description: "Lean surplus and high protein for hypertrophy",
    icon: Dumbbell,
  },
  {
    id: "loseFat",
    label: "Lose fat",
    description: "Moderate deficit to lean down while preserving muscle",
    icon: Flame,
  },
  {
    id: "getStronger",
    label: "Get stronger",
    description: "Progressive overload with strength-focused nutrition",
    icon: TrendingUp,
  },
  {
    id: "stayConsistent",
    label: "Stay consistent",
    description: "Maintenance calories and sustainable workout habits",
    icon: Calendar,
  },
];

type PlanTemplateOption = {
  id: string;
  name: string;
  daysLabel: string;
  description: string;
};

const PLAN_OPTIONS: PlanTemplateOption[] = [
  {
    id: "Push Pull Legs",
    name: "Push Pull Legs",
    daysLabel: "3–6 days/week",
    description: "Classic push, pull, and legs rotation for full coverage",
  },
  {
    id: "Upper / Lower",
    name: "Upper / Lower",
    daysLabel: "4 days/week",
    description: "Balanced upper and lower body split with great recovery",
  },
  {
    id: "Full body",
    name: "Full body",
    daysLabel: "3 days/week",
    description: "Compound lifts hitting all major muscles every session",
  },
  {
    id: "custom",
    name: "Build my own",
    daysLabel: "Custom",
    description: "Start blank and add your own days and exercises",
  },
];

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoal>("buildMuscle");

  // Body data
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [weightInput, setWeightInput] = useState("70");
  const [heightInput, setHeightInput] = useState("175");
  const [ageInput, setAgeInput] = useState("26");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");

  // Calibrated target adjustments (+/- delta from formula)
  const [kcalAdjust, setKcalAdjust] = useState(0);
  const [proteinAdjust, setProteinAdjust] = useState(0);

  // Training plan
  const [selectedPlan, setSelectedPlan] = useState<string>("Push Pull Legs");

  // North Star why
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

  // Android hardware back button handler
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) {
        setStep((s) => s - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // Compute profile and live targets
  const profile: BodyProfile = useMemo(() => {
    const rawWeight = Number(weightInput) || 70;
    const weightKg = unit === "lb" ? rawWeight * 0.453592 : rawWeight;
    const heightCm = Number(heightInput) || 175;
    const age = Number(ageInput) || 26;

    return {
      weightKg,
      heightCm,
      age,
      sex,
      activityLevel,
      goal,
    };
  }, [weightInput, unit, heightInput, ageInput, sex, activityLevel, goal]);

  const rawTargets = useMemo(() => calculateTargets(profile), [profile]);
  const targets = useMemo(
    () => ({
      ...rawTargets,
      kcal: Math.max(1200, rawTargets.kcal + kcalAdjust),
      protein: Math.max(50, rawTargets.protein + proteinAdjust),
    }),
    [rawTargets, kcalAdjust, proteinAdjust],
  );

  const goalOption = GOALS.find((g) => g.id === goal) ?? GOALS[0]!;

  async function handleFinish() {
    if (busy) return;
    setBusy(true);

    try {
      // 1. Save North Star
      const northStar: NorthStar = {
        title: goalOption.label,
        why: why.trim() || "Stay on track and build consistency.",
        goalType:
          goal === "buildMuscle"
            ? "gainMuscle"
            : goal === "loseFat"
              ? "loseWeight"
              : goal === "getStronger"
                ? "buildStrength"
                : "maintainWeight",
        lastChangedAt: new Date().toISOString(),
      };
      await saveNorthStar(northStar);

      // 2. Save Units
      await setWeightUnit(unit);

      // 3. Save Nourish Settings
      await saveNourishSettings({
        kcal: targets.kcal,
        protein: targets.protein,
        split: targets.split,
        cardioReturn: 0,
        weeklyRate: targets.weeklyRate,
        fallbackWeightKg: targets.fallbackWeightKg,
        prefs: "",
        changeLog: [
          {
            date: new Date().toISOString(),
            change: `Initial targets set during onboarding: ${targets.kcal} kcal, ${targets.protein}g protein`,
          },
        ],
      });

      // 4. Create Forge Starter Plan
      if (selectedPlan !== "custom") {
        try {
          const custom = await getCustomExercises().catch(() => []);
          const catalog = buildCatalog(custom);
          const plan = planFromTemplate(selectedPlan, catalog);
          if (plan) {
            await updateForgeSettings((current) => ({
              ...current,
              plans: [
                ...current.plans.filter((p) => p.name !== plan.name),
                plan,
              ],
              activePlanId: plan.id,
            }));
          }
        } catch {
          // Best effort for plan template
        }
      }

      // 5. Complete Onboarding
      void hapticSuccess();
      await setOnboardingComplete(true);
      onDone();
    } catch {
      showToast("Couldn't save setup, please try again");
      setBusy(false);
    }
  }

  const [reducedMotion, setReducedMotion] = useState(
    process.env.NODE_ENV === "test",
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        ?.then((enabled) => setReducedMotion(enabled))
        ?.catch(() => {});
      const sub = AccessibilityInfo.addEventListener?.(
        "reduceMotionChanged",
        (enabled) => setReducedMotion(enabled),
      );
      return () => sub?.remove?.();
    } catch {}
  }, []);

  const progressScale = useRef(
    new Animated.Value((step + 1) / TOTAL_STEPS),
  ).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const prevStepRef = useRef(step);

  useEffect(() => {
    const targetScale = (step + 1) / TOTAL_STEPS;
    if (reducedMotion || process.env.NODE_ENV === "test") {
      progressScale.setValue(targetScale);
    } else {
      Animated.timing(progressScale, {
        toValue: targetScale,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [step, progressScale, reducedMotion]);

  useEffect(() => {
    if (prevStepRef.current === step) return;
    const dir = step > prevStepRef.current ? 1 : -1;
    prevStepRef.current = step;

    if (reducedMotion || process.env.NODE_ENV === "test") {
      stepOpacity.setValue(1);
      stepTranslateX.setValue(0);
      return;
    }

    stepOpacity.setValue(0);
    stepTranslateX.setValue(dir * 24);

    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateX, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, stepOpacity, stepTranslateX, reducedMotion]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Top Progress Bar */}
      <View
        style={[
          styles.progressTrack,
          { top: insets.top, backgroundColor: theme.line },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.acc,
              transform: [{ scaleX: progressScale }],
            },
          ]}
        />
      </View>

      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {step > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => setStep((s) => s - 1)}
            style={styles.backBtn}
          >
            <ChevronLeft size={22} color={theme.ink} />
          </PressableScale>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        {step > 0 && step < 4 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip step"
            hitSlop={12}
            onPress={() => setStep((s) => s + 1)}
          >
            <Text style={[Type.meta, { color: theme.mute }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Step Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: stepOpacity,
            transform: [{ translateX: stepTranslateX }],
          }}
        >
        {/* STEP 0: WELCOME */}
        {step === 0 && (
          <View style={styles.welcomeWrap}>
            <View style={styles.brandHero}>
              <Text
                style={[
                  Type.display,
                  styles.brandWordmark,
                  { color: theme.ink },
                ]}
              >
                GymOS
              </Text>
              <Text
                style={[Type.eyebrow, styles.brandEyebrow, { color: theme.acc }]}
              >
                CALM · CAPABLE · PRIVATE
              </Text>
            </View>

            <View style={styles.welcomeBody}>
              <Text style={[Type.body, styles.promise, { color: theme.ink }]}>
                Your data stays entirely on your device.
              </Text>
              <Text
                style={[Type.meta, styles.promiseSub, { color: theme.mute }]}
              >
                No accounts, no cloud sync required, no surveillance. Built
                for quiet consistency in the gym and kitchen.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 1: GOAL */}
        {step === 1 && (
          <View style={styles.stepWrap}>
            <Text style={[Type.display, styles.stepTitle, { color: theme.ink }]}>
              What is your primary goal?
            </Text>
            <Text
              style={[Type.meta, styles.stepSubtitle, { color: theme.mute }]}
            >
              This shapes your nutrition targets and suggested training plan.
            </Text>

            <View style={styles.cardsCol}>
              {GOALS.map((item) => {
                const isSelected = item.id === goal;
                const IconComponent = item.icon;
                return (
                  <PressableScale
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.label}
                    onPress={() => setGoal(item.id)}
                    style={[
                      styles.goalCard,
                      {
                        backgroundColor: isSelected ? theme.card2 : theme.card,
                        borderColor: isSelected ? theme.acc : theme.line,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: isSelected
                            ? "rgba(212, 175, 55, 0.15)"
                            : theme.card2,
                        },
                      ]}
                    >
                      <IconComponent
                        size={22}
                        color={isSelected ? theme.acc : theme.mute}
                      />
                    </View>
                    <View style={styles.goalTextWrap}>
                      <Text
                        style={[
                          Type.rowTitle,
                          styles.goalTitle,
                          { color: theme.ink },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={[Type.meta, { color: theme.mute }]}>
                        {item.description}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: ABOUT YOU */}
        {step === 2 && (
          <View style={styles.stepWrap}>
            <Text style={[Type.display, styles.stepTitle, { color: theme.ink }]}>
              A few details about you
            </Text>
            <Text
              style={[Type.meta, styles.stepSubtitle, { color: theme.mute }]}
            >
              Used to calculate your daily energy expenditure via Mifflin–St
              Jeor.
            </Text>

            {/* Units Toggle */}
            <View style={styles.unitToggleRow}>
              <PressableScale
                onPress={() => setUnit("kg")}
                style={[
                  styles.unitPill,
                  {
                    backgroundColor: unit === "kg" ? theme.acc : theme.card2,
                  },
                ]}
              >
                <Text
                  style={[
                    Type.button,
                    { color: unit === "kg" ? theme.accInk : theme.ink },
                  ]}
                >
                  Metric (kg / cm)
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => setUnit("lb")}
                style={[
                  styles.unitPill,
                  {
                    backgroundColor: unit === "lb" ? theme.acc : theme.card2,
                  },
                ]}
              >
                <Text
                  style={[
                    Type.button,
                    { color: unit === "lb" ? theme.accInk : theme.ink },
                  ]}
                >
                  Imperial (lb / cm)
                </Text>
              </PressableScale>
            </View>

            {/* Numeric Inputs */}
            <View style={styles.inputGrid}>
              <View style={styles.inputCol}>
                <Text style={[Type.eyebrow, { color: theme.mute }]}>
                  WEIGHT ({unit.toUpperCase()})
                </Text>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                  placeholder="70"
                  placeholderTextColor={theme.mute}
                  style={[
                    styles.numInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.line,
                      color: theme.ink,
                    },
                  ]}
                />
              </View>

              <View style={styles.inputCol}>
                <Text style={[Type.eyebrow, { color: theme.mute }]}>
                  HEIGHT (CM)
                </Text>
                <TextInput
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="numeric"
                  placeholder="175"
                  placeholderTextColor={theme.mute}
                  style={[
                    styles.numInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.line,
                      color: theme.ink,
                    },
                  ]}
                />
              </View>

              <View style={styles.inputCol}>
                <Text style={[Type.eyebrow, { color: theme.mute }]}>AGE</Text>
                <TextInput
                  value={ageInput}
                  onChangeText={setAgeInput}
                  keyboardType="numeric"
                  placeholder="26"
                  placeholderTextColor={theme.mute}
                  style={[
                    styles.numInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.line,
                      color: theme.ink,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Sex Selector */}
            <View style={styles.sectionWrap}>
              <Text style={[Type.eyebrow, { color: theme.mute, marginBottom: 8 }]}>
                SEX (FOR BMR FORMULA)
              </Text>
              <View style={styles.pillsRow}>
                {(["male", "female", "unspecified"] as Sex[]).map((s) => (
                  <PressableScale
                    key={s}
                    onPress={() => setSex(s)}
                    style={[
                      styles.choicePill,
                      {
                        backgroundColor: sex === s ? theme.acc : theme.card,
                        borderColor: sex === s ? theme.acc : theme.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Type.button,
                        styles.choiceText,
                        { color: sex === s ? theme.accInk : theme.ink },
                      ]}
                    >
                      {s === "unspecified"
                        ? "Prefer not to say"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Activity Level */}
            <View style={styles.sectionWrap}>
              <Text style={[Type.eyebrow, { color: theme.mute, marginBottom: 8 }]}>
                ACTIVITY LEVEL
              </Text>
              <View style={styles.pillsRow}>
                {(
                  [
                    ["sedentary", "Sedentary"],
                    ["light", "Light (1–3d)"],
                    ["moderate", "Moderate (3–5d)"],
                    ["heavy", "Heavy (6–7d)"],
                  ] as [ActivityLevel, string][]
                ).map(([val, label]) => (
                  <PressableScale
                    key={val}
                    onPress={() => setActivityLevel(val)}
                    style={[
                      styles.choicePill,
                      {
                        backgroundColor:
                          activityLevel === val ? theme.acc : theme.card,
                        borderColor:
                          activityLevel === val ? theme.acc : theme.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Type.button,
                        styles.choiceText,
                        { color: activityLevel === val ? theme.accInk : theme.ink },
                      ]}
                    >
                      {label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Calculated Targets Card */}
            <Card style={styles.targetsCard}>
              <View style={styles.targetHeaderRow}>
                <Text style={[Type.eyebrow, { color: theme.acc }]}>
                  CALIBRATED DAILY TARGETS
                </Text>
                <Text style={[Type.meta, { color: theme.mute }]}>
                  Mifflin–St Jeor
                </Text>
              </View>

              <View style={styles.targetsSplitRow}>
                <View style={styles.targetMetric}>
                  <Text style={[Type.numeralXL, { color: theme.ink }]}>
                    {targets.kcal}
                  </Text>
                  <Text style={[Type.meta, { color: theme.mute }]}>
                    kcal / day
                  </Text>
                  <View style={styles.stepperRow}>
                    <PressableScale
                      onPress={() => setKcalAdjust((k) => k - 50)}
                      style={[styles.stepperBtn, { backgroundColor: theme.card2 }]}
                    >
                      <Minus size={14} color={theme.ink} />
                    </PressableScale>
                    <PressableScale
                      onPress={() => setKcalAdjust((k) => k + 50)}
                      style={[styles.stepperBtn, { backgroundColor: theme.card2 }]}
                    >
                      <Plus size={14} color={theme.ink} />
                    </PressableScale>
                  </View>
                </View>

                <View style={styles.targetMetric}>
                  <Text style={[Type.numeralXL, { color: theme.ink }]}>
                    {targets.protein}g
                  </Text>
                  <Text style={[Type.meta, { color: theme.mute }]}>
                    protein / day
                  </Text>
                  <View style={styles.stepperRow}>
                    <PressableScale
                      onPress={() => setProteinAdjust((p) => p - 5)}
                      style={[styles.stepperBtn, { backgroundColor: theme.card2 }]}
                    >
                      <Minus size={14} color={theme.ink} />
                    </PressableScale>
                    <PressableScale
                      onPress={() => setProteinAdjust((p) => p + 5)}
                      style={[styles.stepperBtn, { backgroundColor: theme.card2 }]}
                    >
                      <Plus size={14} color={theme.ink} />
                    </PressableScale>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* STEP 3: TRAINING */}
        {step === 3 && (
          <View style={styles.stepWrap}>
            <Text style={[Type.display, styles.stepTitle, { color: theme.ink }]}>
              Choose your starter plan
            </Text>
            <Text
              style={[Type.meta, styles.stepSubtitle, { color: theme.mute }]}
            >
              Forge sets this as your active plan. You can edit exercises or days
              anytime.
            </Text>

            <View style={styles.cardsCol}>
              {PLAN_OPTIONS.map((plan) => {
                const isSelected = plan.id === selectedPlan;
                return (
                  <PressableScale
                    key={plan.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={plan.name}
                    onPress={() => setSelectedPlan(plan.id)}
                    style={[
                      styles.goalCard,
                      {
                        backgroundColor: isSelected ? theme.card2 : theme.card,
                        borderColor: isSelected ? theme.acc : theme.line,
                      },
                    ]}
                  >
                    <View style={styles.goalTextWrap}>
                      <View style={styles.planHeaderRow}>
                        <Text
                          style={[
                            Type.rowTitle,
                            styles.goalTitle,
                            { color: theme.ink },
                          ]}
                        >
                          {plan.name}
                        </Text>
                        <Text style={[Type.eyebrow, { color: theme.acc }]}>
                          {plan.daysLabel}
                        </Text>
                      </View>
                      <Text style={[Type.meta, { color: theme.mute }]}>
                        {plan.description}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 4: YOUR WHY & REVIEW */}
        {step === 4 && (
          <View style={styles.stepWrap}>
            <Text style={[Type.display, styles.stepTitle, { color: theme.ink }]}>
              Your North Star
            </Text>
            <Text
              style={[Type.meta, styles.stepSubtitle, { color: theme.mute }]}
            >
              A single reason you can revisit whenever motivation dips.
            </Text>

            <TextInput
              value={why}
              onChangeText={setWhy}
              placeholder="e.g. Build lifelong strength and energy"
              placeholderTextColor={theme.mute}
              multiline
              maxLength={150}
              style={[
                styles.whyInput,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.line,
                  color: theme.ink,
                },
              ]}
              accessibilityLabel="Your motivation"
            />

            <Card style={styles.reviewCard}>
              <Text
                style={[Type.eyebrow, { color: theme.acc, marginBottom: 8 }]}
              >
                HERE&apos;S YOUR DAY
              </Text>
              <Text style={[Type.title, { color: theme.ink, marginBottom: 4 }]}>
                {goalOption.label}
              </Text>
              <Text style={[Type.body, { color: theme.mute, marginBottom: 12 }]}>
                <CountUp value={targets.kcal} /> kcal ·{" "}
                <CountUp value={targets.protein} />g protein ·{" "}
                {selectedPlan}
              </Text>
              <Text style={[Type.meta, { color: theme.mute }]}>
                Ready to track your workouts, nutrition, and recovery.
              </Text>
            </Card>
          </View>
        )}
        </Animated.View>
      </ScrollView>

      {/* Docked 56 dp Primary Action */}
      <View
        style={[
          styles.dockedBar,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: theme.bg,
            borderTopColor: theme.line,
          },
        ]}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            step === 0
              ? "Get started"
              : step === 4
                ? "Open GymOS"
                : "Continue"
          }
          disabled={busy}
          onPress={() => {
            if (step < 4) {
              setStep((s) => s + 1);
            } else {
              void handleFinish();
            }
          }}
          style={[styles.primaryBtn, { backgroundColor: theme.acc }]}
        >
          <Text
            style={[
              Type.button,
              styles.primaryBtnText,
              { color: theme.accInk },
            ]}
          >
            {busy
              ? "Setting up…"
              : step === 0
                ? "Get started"
                : step === 4
                  ? "Open GymOS"
                  : "Continue"}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  progressFill: {
    height: "100%",
    width: "100%",
    transformOrigin: "left",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.l,
    minHeight: Metric.touchMin,
  },
  backBtn: {
    width: Metric.touchMin,
    height: Metric.touchMin,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPlaceholder: {
    width: Metric.touchMin,
    height: Metric.touchMin,
  },
  scrollContent: {
    paddingHorizontal: Space.l,
    paddingTop: Space.m,
  },
  welcomeWrap: {
    paddingTop: 60,
    alignItems: "center",
  },
  brandHero: {
    alignItems: "center",
    marginBottom: 40,
  },
  brandWordmark: {
    fontSize: 48,
    letterSpacing: 2,
  },
  brandEyebrow: {
    marginTop: 8,
    letterSpacing: 2,
  },
  welcomeBody: {
    alignItems: "center",
    paddingHorizontal: Space.m,
  },
  promise: {
    fontSize: 18,
    textAlign: "center",
    fontWeight: "500",
  },
  promiseSub: {
    marginTop: 12,
    textAlign: "center",
    lineHeight: 20,
  },
  stepWrap: {
    paddingTop: Space.s,
  },
  stepTitle: {
    marginBottom: 8,
  },
  stepSubtitle: {
    lineHeight: 19,
    marginBottom: Space.xl,
  },
  cardsCol: {
    gap: Space.m,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Space.l,
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: Space.m,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  goalTextWrap: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 17,
    marginBottom: 4,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  unitToggleRow: {
    flexDirection: "row",
    gap: Space.s,
    marginBottom: Space.l,
  },
  unitPill: {
    flex: 1,
    height: Metric.touchMin,
    borderRadius: Radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  inputGrid: {
    flexDirection: "row",
    gap: Space.s,
    marginBottom: Space.l,
  },
  inputCol: {
    flex: 1,
    gap: 6,
  },
  numInput: {
    height: 48,
    borderRadius: Radius.control,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: Font.sans,
    fontWeight: "500",
  },
  sectionWrap: {
    marginBottom: Space.l,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.xs,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minHeight: Metric.touchMin,
    justifyContent: "center",
  },
  choiceText: {
    fontSize: 14,
  },
  targetsCard: {
    padding: Space.l,
    borderRadius: Radius.card,
    marginTop: Space.s,
    marginBottom: Space.xl,
  },
  targetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.m,
  },
  targetsSplitRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  targetMetric: {
    alignItems: "center",
    gap: 4,
  },
  stepperRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  whyInput: {
    height: 90,
    borderRadius: Radius.control,
    borderWidth: 1,
    padding: Space.m,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: Space.l,
  },
  reviewCard: {
    padding: Space.l,
    borderRadius: Radius.card,
  },
  dockedBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: Space.l,
    borderTopWidth: 1,
  },
  primaryBtn: {
    height: 56,
    borderRadius: Radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "600",
  },
});