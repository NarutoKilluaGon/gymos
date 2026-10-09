import * as Haptics from "expo-haptics";
import {
  BookOpen,
  Camera,
  Droplets,
  Dumbbell,
  Moon,
  Plus,
  Ruler,
  Scale,
  Utensils,
  X,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { JournalSheet } from "@/components/quick-add/journal-sheet";
import { LogFoodSheet } from "@/components/nutrition/log-food-sheet";
import { MeasurementSheet } from "@/components/quick-add/measurement-sheet";
import {
  SleepSheet,
  type SleepInput,
} from "@/components/quick-add/sleep-sheet";
import { WeightSheet } from "@/components/quick-add/weight-sheet";
import { useModules } from "@/contexts/modules-context";
import { FEATURES } from "@/constants/features";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import type { ModuleId } from "@/storage/repositories/modules";
import type { WeightUnit } from "@/storage/repositories/preferences";
import type { JournalEntry } from "@/types/gymos";

type GymFABProps = {
  weightUnit?: WeightUnit;
  onWaterAdd?: (amount: number) => void;
  onWeightAdd?: (weight: number) => void;
  /** Called after food was logged from the quick-add sheet. */
  onMealLogged?: () => void;
  onSleepAdd?: (sleep: SleepInput) => void;
  onWorkoutStart?: () => void;
  onJournalAdd?: (text: string, mood?: JournalEntry["mood"]) => void;
  onProgressPhoto?: () => void;
};

type FABAction = {
  label: string;
  icon: typeof Dumbbell;
  module?: ModuleId;
};

const actions: FABAction[] = [
  { label: "Workout", icon: Dumbbell, module: "workouts" },
  { label: "Meal", icon: Utensils, module: "nutrition" },
  { label: "Water", icon: Droplets },
  { label: "Sleep", icon: Moon },
  { label: "Weight", icon: Scale },
  { label: "Measurements", icon: Ruler },
  { label: "Journal", icon: BookOpen },
  ...(FEATURES.progress
    ? [{ label: "Progress photo", icon: Camera }]
    : []),
];

export function GymFAB({
  weightUnit = "kg",
  onWaterAdd,
  onWeightAdd,
  onMealLogged,
  onSleepAdd,
  onWorkoutStart,
  onJournalAdd,
  onProgressPhoto,
}: GymFABProps) {
  const { enabled } = useModules();

  const [open, setOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [measurementSheetOpen, setMeasurementSheetOpen] = useState(false);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [journalSheetOpen, setJournalSheetOpen] = useState(false);

  const rotAnim = useRef(new Animated.Value(0)).current;

  async function openSheet() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(rotAnim, {
      toValue: 1,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
    setOpen(true);
  }

  async function closeSheet() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(rotAnim, {
      toValue: 0,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
    setOpen(false);
  }

  async function handleAction(label: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.spring(rotAnim, {
      toValue: 0,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
    setOpen(false);

    if (label === "Water") {
      setWaterSheetOpen(true);
      return;
    }

    if (label === "Weight") {
      setWeightSheetOpen(true);
      return;
    }

    if (label === "Measurements") {
      setMeasurementSheetOpen(true);
      return;
    }

    if (label === "Meal") {
      setMealSheetOpen(true);
      return;
    }

    if (label === "Sleep") {
      setSleepSheetOpen(true);
      return;
    }

    if (label === "Journal") {
      setJournalSheetOpen(true);
      return;
    }

    if (label === "Workout") {
      onWorkoutStart?.();
      return;
    }

    if (label === "Progress photo") {
      onProgressPhoto?.();
      return;
    }
  }

  async function handleWaterAdd(amount: number) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onWaterAdd?.(amount / 1000);

    setWaterSheetOpen(false);
  }

  async function handleWeightSave(weight: number) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onWeightAdd?.(weight);

    setWeightSheetOpen(false);
  }

  async function handleSleepSave(sleep: SleepInput) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onSleepAdd?.(sleep);

    setSleepSheetOpen(false);
  }

  async function handleJournalSave(text: string, mood?: JournalEntry["mood"]) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onJournalAdd?.(text, mood);

    setJournalSheetOpen(false);
  }

  const visibleActions = actions.filter(
    ({ module }) => !module || enabled[module],
  );

  return (
    <>
      {/* FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open quick add"
        onPress={openSheet}
        style={styles.fab}
      >
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "45deg"],
                }),
              },
            ],
          }}
        >
          <Plus size={28} color={GymColors.text.primary} />
        </Animated.View>
      </Pressable>

      {/* Main Quick Add Sheet */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.title}>Quick add</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close quick add"
                onPress={closeSheet}
                style={styles.closeButton}
              >
                <X size={22} color={GymColors.text.secondary} />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {visibleActions.map(({ label, icon: Icon }) => (
                <Pressable
                  key={label}
                  onPress={() => handleAction(label)}
                  style={styles.action}
                >
                  <View style={styles.iconContainer}>
                    <Icon size={24} color={GymColors.text.primary} />
                  </View>

                  <Text style={styles.actionLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Water Sheet */}
      <Modal
        visible={waterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWaterSheetOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setWaterSheetOpen(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.title}>Quick add water</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close water quick add"
                onPress={() => setWaterSheetOpen(false)}
                style={styles.closeButton}
              >
                <X size={22} color={GymColors.text.secondary} />
              </Pressable>
            </View>

            <View style={styles.waterOptions}>
              {[250, 500, 750, 1000].map((amount) => (
                <Pressable
                  key={amount}
                  style={styles.waterButton}
                  onPress={() => handleWaterAdd(amount)}
                >
                  <Text style={styles.waterText}>
                    {amount >= 1000 ? "1 L" : `${amount} mL`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Weight Sheet */}
      <WeightSheet
        visible={weightSheetOpen}
        unit={weightUnit}
        onClose={() => setWeightSheetOpen(false)}
        onSave={handleWeightSave}
      />

      {/* Measurements Sheet */}
      <MeasurementSheet
        visible={measurementSheetOpen}
        onClose={() => setMeasurementSheetOpen(false)}
      />

      {/* Meal Sheet */}
      <LogFoodSheet
        visible={mealSheetOpen}
        onClose={() => setMealSheetOpen(false)}
        onLogged={onMealLogged}
      />

      {/* Sleep Sheet */}
      <SleepSheet
        visible={sleepSheetOpen}
        onClose={() => setSleepSheetOpen(false)}
        onSave={handleSleepSave}
      />

      {/* Journal Sheet */}
      <JournalSheet
        visible={journalSheetOpen}
        onClose={() => setJournalSheetOpen(false)}
        onSave={handleJournalSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GymColors.semantic.accent,
    alignItems: "center",
    justifyContent: "center",
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

  sheetHeader: {
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

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },

  action: {
    width: "28%",
    alignItems: "center",
    gap: Spacing.one,
  },

  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: Radius.large,
    backgroundColor: GymColors.background.card,
    alignItems: "center",
    justifyContent: "center",
  },

  actionLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    textAlign: "center",
  },

  waterOptions: {
    gap: Spacing.two,
  },

  waterButton: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  waterText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});