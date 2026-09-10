import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { setOnboardingComplete } from "@/storage/repositories/onboarding";
import { saveNorthStar } from "@/storage/repositories/north-star";
import { showToast } from "@/utils/toast";
import type { GoalType, NorthStar } from "@/types/gymos";

type Props = {
  onDone: () => void;
};

const TOTAL_STEPS = 4;

type GoalOption = {
  id: GoalType;
  label: string;
  emoji: string;
};

const GOALS: GoalOption[] = [
  { id: "gainMuscle", label: "Gain muscle", emoji: "💪" },
  { id: "buildStrength", label: "Build strength", emoji: "🏋️" },
  { id: "loseWeight", label: "Lose weight", emoji: "⚖️" },
  { id: "maintainWeight", label: "Maintain", emoji: "🧘" },
  { id: "improveEndurance", label: "Endurance", emoji: "🏃" },
];

function StepDots({ step }: { step: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === step && styles.dotActive]}
        />
      ))}
    </View>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.heroEmoji}>🏋️</Text>

      <Text style={styles.stepTitle}>Welcome to GymOS</Text>

      <Text style={styles.stepBody}>
        Your data stays on your device. No accounts, no cloud, just
        you and your progress.
      </Text>

      <Text style={styles.stepBody}>
        Let&apos;s set one thing first — your North Star goal.
      </Text>

      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Continue onboarding"
        style={styles.nextButton}
      >
        <Text style={styles.nextButtonText}>Get started</Text>
      </Pressable>
    </View>
  );
}

function GoalStep({
  goal,
  setGoal,
  onNext,
  onBack,
}: {
  goal: GoalType | undefined;
  setGoal: (g: GoalType) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What&apos;s your goal?</Text>

      <Text style={styles.stepSubtitle}>
        Pick the one that matters most right now.
      </Text>

      <View style={styles.goalList}>
        {GOALS.map((option) => {
          const selected = option.id === goal;

          return (
            <Pressable
              key={option.id}
              onPress={() => setGoal(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.goalRow, selected && styles.goalRowSelected]}
            >
              <Text style={styles.goalEmoji}>{option.emoji}</Text>
              <Text
                style={[styles.goalLabel, selected && styles.goalLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          disabled={!goal}
          style={[styles.nextButton, !goal && styles.nextButtonDisabled]}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WhyStep({
  why,
  setWhy,
  onNext,
  onBack,
}: {
  why: string;
  setWhy: (t: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Why does this matter?</Text>

      <Text style={styles.stepSubtitle}>
        A short sentence you can read when motivation dips.
      </Text>

      <TextInput
        value={why}
        onChangeText={setWhy}
        placeholder="e.g. I want to feel strong and confident"
        placeholderTextColor={GymColors.text.disabled}
        multiline
        maxLength={200}
        style={styles.textInput}
        accessibilityLabel="Your motivation"
      />

      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Continue onboarding"
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DoneStep({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.heroEmoji}>✅</Text>

      <Text style={styles.stepTitle}>You&apos;re all set</Text>

      <Text style={styles.stepBody}>
        Open the app whenever you&apos;re ready. Everything lives on this
        device — no accounts to remember.
      </Text>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Finish onboarding and open the app"
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>Open GymOS</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalType | undefined>();
  const [why, setWhy] = useState("");

  async function handleDone() {
    try {
      if (goal) {
        const northStar: NorthStar = {
          title: GOALS.find((g) => g.id === goal)?.label ?? goal,
          why: why || "Stay on track.",
          goalType: goal,
          lastChangedAt: new Date().toISOString(),
        };

        await saveNorthStar(northStar);
      }

      await setOnboardingComplete(true);
      onDone();
    } catch {
      showToast("Couldn't finish setup");
    }
  }

  return (
    <View style={styles.container}>
      <StepDots step={step} />

      {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}

      {step === 1 && (
        <GoalStep
          goal={goal}
          setGoal={setGoal}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <WhyStep
          why={why}
          setWhy={setWhy}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && <DoneStep onBack={() => setStep(2)} onDone={handleDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.seven,
    paddingBottom: Spacing.six,
  },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.two,
    marginBottom: Spacing.seven,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GymColors.text.disabled,
  },

  dotActive: {
    backgroundColor: GymColors.semantic.accent,
  },

  stepContent: {
    flex: 1,
    justifyContent: "center",
  },

  heroEmoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.four,
  },

  stepTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginBottom: Spacing.two,
  },

  stepSubtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginBottom: Spacing.four,
  },

  stepBody: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 24,
    marginBottom: Spacing.three,
  },

  goalList: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },

  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },

  goalRowSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  goalEmoji: {
    fontSize: 22,
  },

  goalLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  goalLabelSelected: {
    color: GymColors.background.primary,
  },

  textInput: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: Spacing.five,
  },

  buttonRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  nextButton: {
    flex: 1,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  nextButtonDisabled: {
    opacity: 0.4,
  },

  nextButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  backButton: {
    flex: 1,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  backButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});