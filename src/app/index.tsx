import { router, useFocusEffect } from "expo-router";
import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import { SupplementLogSheet } from "@/components/dashboard/supplement-log-sheet";
import { Greeting } from "@/components/dashboard/greeting";
import { NorthStarCard } from "@/components/dashboard/north-star-card";
import { StreakCard } from "@/components/dashboard/streak-card";
import { NorthStarSetupCard } from "@/components/dashboard/north-star-setup-card";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { GymFAB } from "@/components/fab/gym-fab";
import { FadeIn } from "@/components/ui/fade-in";
import { useModules } from "@/contexts/modules-context";
import type { SleepInput } from "@/components/quick-add/sleep-sheet";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { addJournalEntry } from "@/storage/repositories/journal";
import { addMeasurement } from "@/storage/repositories/measurements";
import {
  getDailyMacroTotals,
  getTodayMeals,
} from "@/storage/repositories/meals";
import { getNorthStar } from "@/storage/repositories/north-star";
import { getNourishSettings } from "@/storage/repositories/nourish-settings";
import {
  getEnabledSupplementProgress,
  type SupplementProgress,
} from "@/storage/repositories/supplement-logs";
import { getRoutines } from "@/storage/repositories/routines";
import {
  deleteSleepSession,
  getTodaySleep,
  logSleepDuration,
} from "@/storage/repositories/sleep";
import { getTodaySteps } from "@/storage/repositories/steps";
import { addWater, getTodayWater } from "@/storage/repositories/water";
import {
  getTodayWorkouts,
} from "@/storage/repositories/workouts";
import { pickAndSavePhotoFromLibrary } from "@/services/progress-photos";
import { getStreak, type Streak } from "@/services/streak";
import type {
  JournalEntry,
  Meal,
  NorthStar,
  Routine,
  SleepSession,
  WorkoutSession,
} from "@/types/gymos";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

const DEFAULT_WATER = 0;

function formatSleepDuration(sessions: SleepSession[]): string | undefined {
  const totalMs = sessions.reduce((sum, session) => {
    if (session.endedAt === undefined) {
      return sum;
    }

    return (
      sum +
      (new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime())
    );
  }, 0);

  if (totalMs <= 0) {
    return undefined;
  }

  const totalMinutes = Math.round(totalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function getSuggestion(
  activeWorkout: WorkoutSession | undefined,
  meals: Meal[],
  waterLitres: number,
  protein: number,
  proteinTarget: number | undefined,
  supplementProgress: SupplementProgress,
  steps: number,
  stepsTarget: number,
  sleep: SleepSession[],
  streak: number,
  nutritionEnabled: boolean,
): string {
  if (activeWorkout) {
    return `Continue your workout — ${activeWorkout.exercises.length} ${
      activeWorkout.exercises.length === 1 ? "exercise" : "exercises"
    } logged.`;
  }

  if (waterLitres <= 0) {
    return "Start your day with a glass of water.";
  }

  if (waterLitres < 2) {
    return `Stay hydrated — ${(2 - waterLitres).toFixed(1)}L to go today.`;
  }

  if (meals.length === 0) {
    return "Don't forget to log your first meal.";
  }

  if (nutritionEnabled && proteinTarget && protein < proteinTarget * 0.5) {
    return `Protein is low — ${Math.round(proteinTarget - protein)}g to hit your target.`;
  }

  if (supplementProgress.total > 0 && supplementProgress.taken < supplementProgress.total) {
    const remaining = supplementProgress.total - supplementProgress.taken;
    return `Take your supplements — ${remaining} remaining.`;
  }

  if (steps < stepsTarget * 0.5) {
    return `Get moving — ${stepsTarget - steps} steps to go today.`;
  }

  const hasSleep = sleep.some((s) => s.endedAt);
  if (!hasSleep) {
    return "Log your sleep when you wake up tomorrow.";
  }

  if (streak >= 7) {
    return `${streak}-day streak — don't break the chain!`;
  }

  if (streak >= 3) {
    return `${streak} days strong — keep the momentum going.`;
  }

  const hour = new Date().getHours();
  if (hour >= 17) {
    return "Evening workout? It's never too late to move.";
  }

  return "Ready for today's workout?";
}

export default function HomeScreen() {
  const { enabled } = useModules();
  const { unit: weightUnit } = useWeightUnit();

  const [water, setWater] = useState(DEFAULT_WATER);

  const [northStar, setNorthStar] = useState<NorthStar | null>(null);

  const [activeWorkout, setActiveWorkout] =
    useState<WorkoutSession | undefined>();

  const [scheduledRoutine, setScheduledRoutine] =
    useState<Routine | null>(null);

  const [meals, setMeals] = useState<Meal[]>([]);

  const [protein, setProtein] = useState(0);

  const [proteinTarget, setProteinTarget] = useState<number | undefined>();


  const [supplementProgress, setSupplementProgress] =
    useState<SupplementProgress>({ total: 0, taken: 0 });

  const [supplementSheetOpen, setSupplementSheetOpen] = useState(false);

  const [steps, setSteps] = useState(0);

  const [sleep, setSleep] = useState<SleepSession[]>([]);

  const [streak, setStreak] = useState<Streak>({ days: 0, todayActive: false });

  useFocusEffect(
    useCallback(() => {
      async function loadHome() {
        try {
          const totalWaterMl = await getTodayWater();

          setWater(totalWaterMl / 1000);

          const storedNorthStar = await getNorthStar();

          setNorthStar(storedNorthStar);

          const workouts = await getTodayWorkouts();

          setActiveWorkout(
            workouts.find((workout) => workout.endedAt === undefined),
          );

          const macros = await getDailyMacroTotals(
            getTodayKey(),
          );

          setProtein(macros.protein);

          setMeals(await getTodayMeals());

          setSleep(await getTodaySleep());

          setSteps(await getTodaySteps());

          setStreak(await getStreak());

          const nutritionSettings = await getNourishSettings();

          setProteinTarget(nutritionSettings.protein);

          setSupplementProgress(
            await getEnabledSupplementProgress(),
          );

          const routines = await getRoutines();

          const dayOfWeek = new Date().getDay();

          const scheduledIndex =
            dayOfWeek === 0 || dayOfWeek === 6 ? 0 : dayOfWeek - 1;

          setScheduledRoutine(routines[scheduledIndex] ?? routines[0] ?? null);
        } catch {
          showToast("Couldn't load today's data");
        }
      }

      loadHome();
    }, []),
  );

  async function handleWaterAdd(amountLitres: number) {
    try {
      const amountMl = amountLitres * 1000;

      await addWater(amountMl);

      const totalWaterMl = await getTodayWater();

      setWater(totalWaterMl / 1000);
    } catch {
      showToast("Couldn't save water");
    }
  }

  async function handleWeightAdd(weight: number) {
    try {
      await addMeasurement("weight", weight, weightUnit);
    } catch {
      showToast("Couldn't save weight");
    }
  }

  /** Food was logged from the quick-add sheet (which already saved it). */
  async function handleMealLogged() {
    try {
      setMeals(await getTodayMeals());

      const macros = await getDailyMacroTotals(getTodayKey());
      setProtein(macros.protein);
    } catch {
      // The meal is already persisted; the next focus refresh catches up.
    }
  }

  async function handleSupplementsChanged() {
    try {
      setSupplementProgress(
        await getEnabledSupplementProgress(),
      );
    } catch {
      showToast("Couldn't load supplements");
    }
  }

  async function handleSleepAdd(sleep: SleepInput) {
    try {
      await logSleepDuration(sleep.hours, sleep.minutes);
      setSleep(await getTodaySleep());
    } catch {
      showToast("Couldn't save sleep");
    }
  }

  function handleSleepDeleteLongPress() {
    const latest = sleep.find((s) => s.endedAt) ?? sleep[0];

    if (!latest) return;

    Alert.alert(
      "Delete today's sleep log?",
      "This removes the logged sleep and can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSleepSession(latest.id)
              .then(async () => {
                setSleep(await getTodaySleep());
              })
              .catch(() => {
                showToast("Couldn't delete sleep");
              });
          },
        },
      ],
    );
  }

  /** Forge's Today tab owns starting a workout (plan day, blank, or
   *  backdated), so Home just opens it. */
  function handleWorkoutStart() {
    router.push("/workouts");
  }

  async function handleJournalAdd(text: string, mood?: JournalEntry["mood"]) {
    try {
      await addJournalEntry(text, mood);
    } catch {
      showToast("Couldn't save journal entry");
    }
  }

  function handleProgressPhoto() {
    pickAndSavePhotoFromLibrary();
  }

  const suggestion = getSuggestion(
    activeWorkout,
    meals,
    water,
    protein,
    proteinTarget,
    supplementProgress,
    steps,
    8000,
    sleep,
    streak.days,
    enabled.nutrition,
  );

  return (
    <View style={styles.container}>
      <FadeIn delay={0}>
        <Greeting />
      </FadeIn>

      <FadeIn delay={20}>
        <View style={styles.streakWorkoutRow}>
          <View style={styles.halfCard}>
            <StreakCard
              streak={streak.days}
              todayActive={streak.todayActive}
            />
          </View>
          {enabled.workouts && (
            <View style={styles.halfCard}>
              <WorkoutCard
                workout={activeWorkout}
                routine={scheduledRoutine}
              />
            </View>
          )}
        </View>
      </FadeIn>

      <FadeIn delay={40}>
        {northStar ? (
          <NorthStarCard
            northStar={northStar}
            onNorthStarChange={setNorthStar}
          />
        ) : (
          <NorthStarSetupCard onCreated={setNorthStar} />
        )}
      </FadeIn>

      <FadeIn delay={60}>
        <DailyTargetsCard
          water={water}
          mealsLogged={meals.length}
          sleep={formatSleepDuration(sleep)}
          protein={protein}
          proteinTarget={proteinTarget}
          supplementsTaken={supplementProgress.taken}
          supplementsTotal={supplementProgress.total}
          steps={steps}
          stepsTarget={8000}
          nutritionEnabled={enabled.nutrition}
          onEditTargets={() =>
            router.navigate({ pathname: "/nutrition", params: { view: "me" } })
          }
          onSupplementsPress={() => setSupplementSheetOpen(true)}
          onSleepDeleteLongPress={handleSleepDeleteLongPress}
          compact
        />
      </FadeIn>

      <FadeIn delay={80}>
        <View style={styles.suggestionInline}>
          <Text style={styles.suggestionLabel}>SUGGESTION</Text>
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </View>
      </FadeIn>

      <GymFAB
        weightUnit={weightUnit}
        onWaterAdd={handleWaterAdd}
        onWeightAdd={handleWeightAdd}
        onMealLogged={handleMealLogged}
        onSleepAdd={handleSleepAdd}
        onWorkoutStart={handleWorkoutStart}
        onJournalAdd={handleJournalAdd}
        onProgressPhoto={handleProgressPhoto}
      />

      <SupplementLogSheet
        visible={supplementSheetOpen}
        onClose={() => setSupplementSheetOpen(false)}
        onChanged={handleSupplementsChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 100, // Space for FAB
  },

  streakWorkoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },

  halfCard: {
    flex: 1,
    minWidth: 0,
  },

  suggestionInline: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: 16,
  },

  suggestionLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.half,
  },

  suggestionText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 20,
  },
});
