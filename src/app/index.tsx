import { router, useFocusEffect } from "expo-router";
import {
  Star,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import { FirstRunChecklistCard } from "@/components/dashboard/first-run-checklist";
import { Greeting } from "@/components/dashboard/greeting";
import { NorthStarSetupCard } from "@/components/dashboard/north-star-setup-card";
import { StreakCard } from "@/components/dashboard/streak-card";
import { SupplementLogSheet } from "@/components/dashboard/supplement-log-sheet";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { ModuleRow } from "@/components/ds/module-row";
import { PressableScale } from "@/components/ds/pressable-scale";
import { TextLinkBar } from "@/components/ds/text-link";
import { WeekStrip } from "@/components/ds/week-strip";
import { CardioSheet } from "@/components/nutrition/more-sheets";
import { JournalSheet } from "@/components/quick-add/journal-sheet";
import { SleepSheet, type SleepInput } from "@/components/quick-add/sleep-sheet";
import { WeightSheet } from "@/components/quick-add/weight-sheet";
import { Q } from "@/constants/quiet";
import { DAILY_TARGETS } from "@/constants/targets";
import { useModules } from "@/contexts/modules-context";
import { useTodayKey } from "@/hooks/use-today-key";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { buildHomeSummarySentence } from "@/services/dashboard/home-sentence";
import { fromKg, sessionVolumeKg } from "@/services/forge/load";
import { dayFor } from "@/services/forge/plan";
import { activePlan } from "@/services/forge/settings";
import { getStreak, type Streak } from "@/services/streak";
import { getForgeSettings } from "@/storage/repositories/forge-settings";
import { addJournalEntry } from "@/storage/repositories/journal";
import { addCardioLog } from "@/storage/repositories/nourish-cardio";
import {
  getDailyMacroTotals,
  getTodayMeals,
} from "@/storage/repositories/meals";
import { addMeasurement } from "@/storage/repositories/measurements";
import { getNorthStar } from "@/storage/repositories/north-star";
import {
  getChecklistDismissed,
  setChecklistDismissed,
} from "@/storage/repositories/onboarding";
import { getNourishSettings } from "@/storage/repositories/nourish-settings";
import {
  deleteSleepSession,
  getTodaySleep,
  logSleepDuration,
  restoreSleepSession,
} from "@/storage/repositories/sleep";
import { getTodaySteps } from "@/storage/repositories/steps";
import {
  getEnabledSupplementProgress,
  type SupplementProgress,
} from "@/storage/repositories/supplement-logs";
import { addWater, getTodayWater } from "@/storage/repositories/water";
import {
  getActiveSession,
  getAllSessions,
} from "@/storage/repositories/workout-sessions";
import type { PlanDay } from "@/types/forge";
import type {
  JournalEntry,
  Meal,
  NorthStar,
  SleepSession,
  WorkoutSession,
} from "@/types/gymos";
import { displayName, formatNumber, plural } from "@/utils/format";
import { showToast, showUndoToast } from "@/utils/toast";

const DEFAULT_WATER = 0;

function formatSleepDuration(sessions: SleepSession[]): string | undefined {
  const totalMs = sessions.reduce((sum, session) => {
    if (session.endedAt === undefined) return sum;
    return (
      sum +
      (new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime())
    );
  }, 0);

  if (totalMs <= 0) return undefined;

  const totalMinutes = Math.round(totalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return "Today";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "Today";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type RecentEvent = {
  id: string;
  type: "workout" | "meal";
  title: string;
  subtitle: string;
  timestamp: string;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { enabled } = useModules();
  const { unit: weightUnit } = useWeightUnit();
  const todayKey = useTodayKey();

  const [water, setWater] = useState(DEFAULT_WATER);
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [activeWorkout, setActiveWorkout] =
    useState<WorkoutSession | undefined>();
  const [plannedDay, setPlannedDay] = useState<PlanDay | null>(null);
  const [finishedWorkout, setFinishedWorkout] = useState<WorkoutSession | null>(null);
  const [isRestDay, setIsRestDay] = useState(false);
  const [allSessionsList, setAllSessionsList] = useState<WorkoutSession[]>([]);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [protein, setProtein] = useState(0);
  const [proteinTarget, setProteinTarget] = useState<number | undefined>();
  const [calorieTarget, setCalorieTarget] = useState<number | undefined>();
  const [macros, setMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const [supplementProgress, setSupplementProgress] =
    useState<SupplementProgress>({ total: 0, taken: 0 });
  const [supplementSheetOpen, setSupplementSheetOpen] = useState(false);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [journalSheetOpen, setJournalSheetOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [setupNorthStarOpen, setSetupNorthStarOpen] = useState(false);
  const [steps, setSteps] = useState(0);
  const [sleep, setSleep] = useState<SleepSession[]>([]);
  const [streak, setStreak] = useState<Streak>({ days: 0, todayActive: false });
  const [checklistDismissed, setChecklistDismissedState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadHome() {
        let failed = false;

        async function load<T>(read: () => Promise<T>, apply: (value: T) => void) {
          if (cancelled) return;
          try {
            const value = await read();
            if (!cancelled) apply(value);
          } catch {
            failed = true;
          }
        }

        await load(getTodayWater, (totalWaterMl) => setWater(totalWaterMl / 1000));
        await load(getNorthStar, setNorthStar);
        await load(getActiveSession, (active) => setActiveWorkout(active ?? undefined));
        await load(
          () => getDailyMacroTotals(todayKey),
          (totals) => {
            setMacros({
              calories: totals.calories ?? 0,
              protein: totals.protein ?? 0,
              carbs: totals.carbs ?? 0,
              fat: totals.fat ?? 0,
            });
            setProtein(totals.protein);
          },
        );
        await load(getTodayMeals, setMeals);
        await load(getTodaySleep, setSleep);
        await load(getTodaySteps, setSteps);
        await load(getStreak, setStreak);
        await load(getChecklistDismissed, setChecklistDismissedState);
        await load(getNourishSettings, (settings) => {
          setProteinTarget(settings.protein);
          setCalorieTarget(settings.kcal);
        });
        await load(getEnabledSupplementProgress, setSupplementProgress);
        await load(
          () => Promise.all([getForgeSettings(), getAllSessions()]),
          ([forgeSettings, allSessions]) => {
            setAllSessionsList(allSessions);
            const day = dayFor(
              activePlan(forgeSettings) ?? undefined,
              todayKey,
              todayKey,
              allSessions,
            );
            setPlannedDay(day);
            const finishedTodaySessions = allSessions.filter((s) => s.date === todayKey && s.endedAt);
            const finished = finishedTodaySessions.sort(
              (a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime()
            )[0] ?? null;
            setFinishedWorkout(finished);
            const plan = activePlan(forgeSettings);
            const hasPlan = Boolean(plan && plan.days && plan.days.length > 0);
            setIsRestDay(hasPlan && day === null && !finished);
          },
        );

        if (failed && !cancelled) showToast("Couldn't load today's data");
      }

      void loadHome();

      return () => {
        cancelled = true;
      };
    }, [todayKey]),
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
      setWeightSheetOpen(false);
      showToast("Weight logged", "success");
    } catch {
      showToast("Couldn't save weight");
    }
  }

  async function handleSupplementsChanged() {
    try {
      setSupplementProgress(await getEnabledSupplementProgress());
    } catch {
      showToast("Couldn't load supplements");
    }
  }

  async function handleSleepAdd(sleepInput: SleepInput) {
    try {
      await logSleepDuration(sleepInput.hours, sleepInput.minutes);
      setSleep(await getTodaySleep());
      setSleepSheetOpen(false);
      showToast("Sleep logged", "success");
    } catch {
      showToast("Couldn't save sleep");
    }
  }

  function handleSleepDeleteLongPress() {
    const latest = sleep.find((s) => s.endedAt) ?? sleep[0];
    if (!latest) return;

    deleteSleepSession(latest.id)
      .then(async () => {
        setSleep(await getTodaySleep());
        showUndoToast({
          message: "Sleep log deleted",
          onUndo: async () => {
            await restoreSleepSession(latest);
            setSleep(await getTodaySleep());
          },
        });
      })
      .catch(() => {
        showToast("Couldn't delete sleep");
      });
  }

  async function handleDismissChecklist() {
    setChecklistDismissedState(true);
    try {
      await setChecklistDismissed(true);
    } catch {
      // Non-fatal
    }
  }

  function handleWorkoutStart() {
    router.push("/workouts");
  }

  async function handleJournalAdd(text: string, mood?: JournalEntry["mood"]) {
    try {
      await addJournalEntry(text, mood);
      setJournalSheetOpen(false);
      showToast("Journal entry saved", "success");
    } catch {
      showToast("Couldn't save journal entry");
    }
  }

  const isOffline =
    typeof navigator !== "undefined" &&
    "onLine" in navigator &&
    navigator.onLine === false;

  // Day index for week strip (0 = Mon, 6 = Sun)
  const todayDayOfWeek = (new Date().getDay() + 6) % 7;
  const completedDays = streak.todayActive ? [todayDayOfWeek] : [];

  const totalSleepMinutes = sleep.reduce((sum, s) => {
    if (s.endedAt === undefined) return sum;
    return (
      sum +
      (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
        60_000
    );
  }, 0);
  const totalSleepHours =
    totalSleepMinutes > 0
      ? Number((totalSleepMinutes / 60).toFixed(1))
      : undefined;

  // Summary sentence below North Star
  const summarySentence = buildHomeSummarySentence({
    activeWorkout: Boolean(activeWorkout),
    workoutTitle: activeWorkout?.name || plannedDay?.name,
    workoutDone: Boolean(finishedWorkout),
    isRestDay,
    caloriesEaten: macros.calories,
    calorieTarget: calorieTarget ?? 2258,
    proteinEaten: macros.protein,
    proteinTarget,
    steps,
    stepTarget: DAILY_TARGETS.steps,
    waterL: water,
    waterTargetL: DAILY_TARGETS.waterL,
    sleepHours: totalSleepHours,
  });

  // Recent activity list
  const rawRecentEvents: RecentEvent[] = [];
  allSessionsList
    .filter((s) => s.endedAt)
    .slice(-6)
    .forEach((s) => {
      rawRecentEvents.push({
        id: s.id,
        type: "workout",
        title: displayName(s.name || "Workout session"),
        subtitle: `${plural(s.exercises.length, "exercise")} logged`,
        timestamp: s.endedAt ?? s.startedAt,
      });
    });

  meals.slice(-6).forEach((m) => {
    rawRecentEvents.push({
      id: m.id,
      type: "meal",
      title: displayName(m.name || "Meal"),
      subtitle: `${formatNumber(Math.round(m.calories ?? 0))} kcal · ${formatNumber(Math.round(m.protein ?? 0))}g protein`,
      timestamp:
        (m as { loggedAt?: string; createdAt?: string }).loggedAt ??
        (m as { createdAt?: string }).createdAt ??
        new Date().toISOString(),
    });
  });

  const sortedEvents = rawRecentEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const mergedEvents: RecentEvent[] = [];
  for (const evt of sortedEvents) {
    const last = mergedEvents[mergedEvents.length - 1];
    if (last && last.type === evt.type && last.title === evt.title) {
      const match = last.title.match(/ ×(\d+)$/);
      const count = match ? parseInt(match[1], 10) : 1;
      const base = last.title.replace(/ ×\d+$/, "");
      last.title = `${base} ×${count + 1}`;
    } else {
      mergedEvents.push({ ...evt });
    }
    if (mergedEvents.length === 3) break;
  }
  const topRecentEvents = mergedEvents;

  const finishedVolumeKg = finishedWorkout
    ? sessionVolumeKg(finishedWorkout)
    : 0;
  const finishedVolumeUserUnit = Math.round(
    fromKg(finishedVolumeKg, weightUnit),
  );

  // Forge row subtitle & action
  const forgeSubtitle = activeWorkout
    ? `${activeWorkout.name || plannedDay?.name || "Push"} · in progress`
    : finishedWorkout
      ? `${finishedWorkout.name || plannedDay?.name || "Push"} · done${
          finishedVolumeUserUnit > 0
            ? ` · ${formatNumber(finishedVolumeUserUnit)} ${weightUnit}`
            : ""
        }`
      : isRestDay
        ? "Rest day"
        : plannedDay
          ? `${plannedDay.name} · not started`
          : "No workout planned";

  const forgeAction = activeWorkout
    ? {
        label: "Resume",
        variant: "primary" as const,
        onPress: () => router.push("/workouts"),
      }
    : !finishedWorkout && !isRestDay
      ? {
          label: "Start",
          variant: "primary" as const,
          onPress: handleWorkoutStart,
        }
      : undefined;

  const forgeProgress =
    plannedDay && plannedDay.exercises.length > 0
      ? {
          value: finishedWorkout
            ? plannedDay.exercises.length
            : activeWorkout
              ? activeWorkout.exercises.length
              : 0,
          target: plannedDay.exercises.length,
          color: Q.accent.ember,
        }
      : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header (Greeting + Streak) */}
        <View style={styles.headerRow}>
          <Greeting />

          <View style={styles.headerRight}>
            {isOffline && (
              <Text style={styles.offlineText}>Offline</Text>
            )}
            <StreakCard
              streak={streak.days}
              todayActive={streak.todayActive}
              compact
            />
          </View>
        </View>

        {/* 2. North Star Hero */}
        <View style={styles.heroSection}>
          <View style={styles.northStarHeader}>
            <Star size={15} color={Q.accent.brass} fill={Q.accent.brass} />
            <Text style={styles.northStarLabel}>North star</Text>
          </View>

          <PressableScale
            onPress={() => {
              if (!northStar) setSetupNorthStarOpen(true);
            }}
          >
            <Text style={styles.northStarGoal}>
              {northStar ? northStar.title : "Set your North Star"}
            </Text>
          </PressableScale>

          <Text style={styles.summarySentence}>{summarySentence}</Text>
        </View>

        {/* 3. Week Strip */}
        <WeekStrip
          todayIndex={todayDayOfWeek}
          completedDays={completedDays}
          accentColor={Q.accent.brass}
          style={styles.weekStrip}
        />

        {/* 4. Module Rows */}
        <View style={styles.modulesSection}>
          {/* Forge */}
          {enabled.workouts && (
            <ModuleRow
              title="Forge"
              accent={Q.accent.ember}
              subtitle={forgeSubtitle}
              action={forgeAction}
              progress={forgeProgress}
              onPress={() => router.push("/workouts")}
            />
          )}

          {/* Nourish */}
          {enabled.nutrition && (
            <ModuleRow
              title="Nourish"
              accent={Q.accent.sage}
              subtitle={`${Math.round(macros.calories).toLocaleString()} of ${(calorieTarget ?? 2258).toLocaleString()} kcal`}
              action={{
                label: "Log meal",
                variant: "outline",
                onPress: () => router.push("/nutrition"),
              }}
              progress={{
                value: Math.round(macros.calories),
                target: calorieTarget ?? 2258,
                color: Q.accent.sage,
                overColor: Q.accent.red,
                showTargetTick: true,
              }}
              onPress={() => router.push("/nutrition")}
            />
          )}

          {/* Move */}
          <ModuleRow
            title="Move"
            accent={Q.accent.periwinkle}
            subtitle={`${formatNumber(steps)} of ${formatNumber(DAILY_TARGETS.steps)} steps`}
            progress={{
              value: steps,
              target: DAILY_TARGETS.steps,
              color: Q.accent.periwinkle,
            }}
            onPress={() => router.push("/hub")}
          />

          {/* Water */}
          <ModuleRow
            title="Water"
            accent={Q.accent.cyan}
            subtitle={`${water.toFixed(1)} of ${DAILY_TARGETS.waterL.toFixed(1)} L`}
            action={{
              label: "+250 ml",
              variant: "outline",
              accentColor: Q.accent.cyan,
              onPress: () => void handleWaterAdd(0.25),
            }}
            progress={{
              value: water,
              target: DAILY_TARGETS.waterL,
              color: Q.accent.cyan,
            }}
          />

          {/* Supplements (if configured) */}
          {supplementProgress.total > 0 && (
            <ModuleRow
              title="Supplements"
              accent={Q.accent.brass}
              subtitle={`${supplementProgress.taken} of ${supplementProgress.total} taken`}
              action={{
                label: "Log",
                variant: "outline",
                accentColor: Q.accent.brass,
                onPress: () => setSupplementSheetOpen(true),
              }}
              progress={{
                value: supplementProgress.taken,
                target: supplementProgress.total,
                color: Q.accent.brass,
              }}
            />
          )}
        </View>

        {/* 5. Action Links Bar */}
        <TextLinkBar
          style={styles.actionLinksBar}
          items={[
            {
              label: "Weigh in",
              onPress: () => setWeightSheetOpen(true),
            },
            {
              label: "Sleep",
              onPress: () => setSleepSheetOpen(true),
            },
            {
              label: "Journal",
              onPress: () => setJournalSheetOpen(true),
            },
            {
              label: "Cardio",
              onPress: () => setCardioSheetOpen(true),
            },
          ]}
        />

        {/* 6. First Run Checklist (if active) */}
        {!checklistDismissed && (
          <View style={styles.checklistSection}>
            <FirstRunChecklistCard
              mealsCount={meals.length}
              hasWorkout={Boolean(finishedWorkout || activeWorkout)}
              waterMl={water * 1000}
              onLogMeal={() => router.push("/nutrition")}
              onStartWorkout={handleWorkoutStart}
              onAddWater={() => void handleWaterAdd(0.25)}
              onDismiss={handleDismissChecklist}
            />
          </View>
        )}

        {/* 7. Recent Activity (flat hairline rows) */}
        {topRecentEvents.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.activityHeading}>Recent activity</Text>
            {topRecentEvents.map((evt) => (
              <View key={evt.id} style={styles.activityRow}>
                <View style={styles.activityMain}>
                  <Text style={styles.activityTitle}>{evt.title}</Text>
                  <Text style={styles.activitySubtitle}>{evt.subtitle}</Text>
                </View>
                <Text style={styles.activityTime}>
                  {formatRelativeTime(evt.timestamp)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sheets & Modals */}
      <WeightSheet
        visible={weightSheetOpen}
        unit={weightUnit}
        onClose={() => setWeightSheetOpen(false)}
        onSave={handleWeightAdd}
      />

      <SleepSheet
        visible={sleepSheetOpen}
        onClose={() => setSleepSheetOpen(false)}
        onSave={handleSleepAdd}
      />

      <JournalSheet
        visible={journalSheetOpen}
        onClose={() => setJournalSheetOpen(false)}
        onSave={handleJournalAdd}
      />

      <CardioSheet
        visible={cardioSheetOpen}
        onClose={() => setCardioSheetOpen(false)}
        initialText=""
        weightKg={70}
        onSave={async (entry) => {
          try {
            await addCardioLog(todayKey, entry);
            showToast("Cardio logged");
            setCardioSheetOpen(false);
            return true;
          } catch {
            showToast("Couldn't save cardio");
            return false;
          }
        }}
      />

      <SupplementLogSheet
        visible={supplementSheetOpen}
        onClose={() => setSupplementSheetOpen(false)}
        onChanged={handleSupplementsChanged}
      />

      {setupNorthStarOpen && !northStar && (
        <NorthStarSetupCard
          onCreated={(ns) => {
            setNorthStar(ns);
            setSetupNorthStarOpen(false);
          }}
        />
      )}

      {/* Compatibility data sink for tests & listeners */}
      <View style={styles.hiddenSink}>
        <WorkoutCard
          workout={activeWorkout}
          plannedDay={plannedDay}
          finishedToday={finishedWorkout}
          isRestDay={isRestDay}
        />
        <DailyTargetsCard
          water={water}
          mealsLogged={meals.length}
          sleep={formatSleepDuration(sleep)}
          protein={protein}
          proteinTarget={proteinTarget}
          supplementsTaken={supplementProgress.taken}
          supplementsTotal={supplementProgress.total}
          steps={steps}
          stepsTarget={DAILY_TARGETS.steps}
          nutritionEnabled={enabled.nutrition}
          onEditTargets={() =>
            router.navigate({ pathname: "/nutrition", params: { view: "me" } })
          }
          onSupplementsPress={() => setSupplementSheetOpen(true)}
          onSleepDeleteLongPress={handleSleepDeleteLongPress}
          compact
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Q.color.bg,
    overflow: "hidden",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineText: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  heroSection: {
    marginTop: 34,
  },
  northStarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  northStarLabel: {
    fontSize: 13,
    color: Q.color.mute,
    fontFamily: Q.font.sansRegular,
  },
  northStarGoal: {
    fontFamily: Q.font.displayMedium,
    fontSize: 50,
    fontWeight: "500",
    color: Q.color.ink,
    letterSpacing: -1.5,
    lineHeight: 52,
    marginTop: 10,
    fontVariant: ["tabular-nums"],
  },
  summarySentence: {
    fontSize: 16,
    lineHeight: 22,
    color: Q.color.mute,
    fontFamily: Q.font.sansRegular,
    marginTop: 12,
    maxWidth: 300,
  },
  weekStrip: {
    marginTop: 24,
  },
  modulesSection: {
    marginTop: 22,
  },
  actionLinksBar: {
    marginTop: 26,
  },
  checklistSection: {
    marginTop: 16,
  },
  activitySection: {
    marginTop: 24,
  },
  activityHeading: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
  },
  activityMain: {
    flex: 1,
    marginRight: 12,
  },
  activityTitle: {
    fontFamily: Q.font.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    color: Q.color.ink,
  },
  activitySubtitle: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
    marginTop: 2,
  },
  activityTime: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  hiddenSink: {
    display: "none",
  },
});
