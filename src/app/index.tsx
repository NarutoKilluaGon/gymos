import { router, useFocusEffect } from "expo-router";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Dumbbell,
  Droplets,
  Plus,
  Scale,
  Sparkles,
  User,
  Utensils,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import { FirstRunChecklistCard } from "@/components/dashboard/first-run-checklist";
import { Greeting } from "@/components/dashboard/greeting";
import { NorthStarCard } from "@/components/dashboard/north-star-card";
import { NorthStarSetupCard } from "@/components/dashboard/north-star-setup-card";
import { StreakCard } from "@/components/dashboard/streak-card";
import { SupplementLogSheet } from "@/components/dashboard/supplement-log-sheet";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { Card } from "@/components/ds/card";
import { PressableScale } from "@/components/ds/pressable-scale";
import { Screen } from "@/components/ds/screen";
import { ScreenHeader } from "@/components/ds/screen-header";
import { GymFAB } from "@/components/fab/gym-fab";
import { CardioSheet } from "@/components/nutrition/more-sheets";
import { JournalSheet } from "@/components/quick-add/journal-sheet";
import type { SleepInput } from "@/components/quick-add/sleep-sheet";
import { FadeIn } from "@/components/ui/fade-in";
import { Font, HOME } from "@/constants/design";
import { DAILY_TARGETS } from "@/constants/targets";
import { Spacing, Typography } from "@/constants/theme";
import { useModules } from "@/contexts/modules-context";
import { useTodayKey } from "@/hooks/use-today-key";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { getHomeSuggestion } from "@/services/dashboard/suggestions";
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
import { getTodayKey } from "@/utils/date";
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
    } catch {
      showToast("Couldn't save weight");
    }
  }

  async function handleMealLogged() {
    try {
      const loadedMeals = await getTodayMeals();
      setMeals(loadedMeals);
      const totals = await getDailyMacroTotals(getTodayKey());
      setMacros({
        calories: totals.calories ?? 0,
        protein: totals.protein ?? 0,
        carbs: totals.carbs ?? 0,
        fat: totals.fat ?? 0,
      });
      setProtein(totals.protein);
    } catch {
      // Focus refresh will reconcile
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
    } catch {
      showToast("Couldn't save journal entry");
    }
  }

  const suggestion = getHomeSuggestion({
    activeWorkout,
    plannedDay,
    finishedWorkout,
    meals,
    waterLitres: water,
    protein,
    proteinTarget,
    sleep,
    nutritionEnabled: enabled.nutrition,
  });

  const now = new Date();
  const dateFormatted = now
    .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
  const todayHeading = `GYMOS · ${dateFormatted}`;

  // Assemble Recent Activity (last 6 items, then sorted and merged)
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

  // Merge consecutive identical entries (e.g. "paneer bhurji ×2"), max 3 rows
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

  const isOffline =
    typeof navigator !== "undefined" &&
    "onLine" in navigator &&
    navigator.onLine === false;

  return (
    <Screen
      bottomPadding={112}
      floating={
        <>
          <GymFAB
            weightUnit={weightUnit}
            onWaterAdd={handleWaterAdd}
            onWeightAdd={handleWeightAdd}
            onMealLogged={handleMealLogged}
            onSleepAdd={handleSleepAdd}
            onWorkoutStart={handleWorkoutStart}
            onJournalAdd={handleJournalAdd}
          />

          <SupplementLogSheet
            visible={supplementSheetOpen}
            onClose={() => setSupplementSheetOpen(false)}
            onChanged={handleSupplementsChanged}
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
                return true;
              } catch {
                showToast("Couldn't save cardio");
                return false;
              }
            }}
          />

          <JournalSheet
            visible={journalSheetOpen}
            onClose={() => setJournalSheetOpen(false)}
            onSave={handleJournalAdd}
          />
        </>
      }
    >
      {/* 1. TOP HEADER */}
      <FadeIn delay={0}>
        <ScreenHeader
          eyebrow={todayHeading}
          title={
            <View style={styles.headerGreetingRow}>
              <PressableScale
                style={styles.avatar}
                onPress={() => router.push("/hub")}
                accessibilityRole="button"
                accessibilityLabel="Profile and settings"
              >
                <User size={18} color={HOME.ink} />
              </PressableScale>
              <Greeting />
            </View>
          }
          right={
            <View style={styles.headerRight}>
              {isOffline && (
                <View style={styles.offlineBadge}>
                  <WifiOff size={12} color="#ef4444" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
              <StreakCard
                streak={streak.days}
                todayActive={streak.todayActive}
                compact
              />
            </View>
          }
        />
      </FadeIn>

      {/* 2. FIRST-RUN CHECKLIST */}
      {!checklistDismissed && (
        <FadeIn delay={10}>
          <FirstRunChecklistCard
            mealsCount={meals.length}
            hasWorkout={Boolean(finishedWorkout || activeWorkout)}
            waterMl={water * 1000}
            onLogMeal={() => router.push("/nutrition")}
            onStartWorkout={handleWorkoutStart}
            onAddWater={() => void handleWaterAdd(0.25)}
            onDismiss={handleDismissChecklist}
          />
        </FadeIn>
      )}

      {/* 3. DYNAMIC HERO CARD (Forge Workout) */}
      {enabled.workouts && (
        <FadeIn delay={20}>
          <WorkoutCard
            workout={activeWorkout}
            plannedDay={plannedDay}
            finishedToday={finishedWorkout}
            isRestDay={isRestDay}
          />
        </FadeIn>
      )}

      {/* 3. QUICK ACTION SHELF */}
      <FadeIn delay={30}>
        <View style={styles.shelfContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfContent}
          >
            <PressableScale
              style={styles.shelfCard}
              onPress={() => void handleWaterAdd(0.25)}
              accessibilityRole="button"
              accessibilityLabel="Add 250ml water"
            >
              <View style={[styles.shelfIconCircle, { backgroundColor: "rgba(6, 182, 212, 0.15)" }]}>
                <Droplets size={18} color="#06b6d4" />
              </View>
              <Text style={styles.shelfLabel}>+250ml Water</Text>
            </PressableScale>

            <PressableScale
              style={styles.shelfCard}
              onPress={() => router.push("/hub")}
              accessibilityRole="button"
              accessibilityLabel="Weigh-in"
            >
              <View style={[styles.shelfIconCircle, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <Scale size={18} color="#3b82f6" />
              </View>
              <Text style={styles.shelfLabel}>Weigh-in</Text>
            </PressableScale>

            <PressableScale
              style={styles.shelfCard}
              onPress={() => setCardioSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Log cardio"
            >
              <View style={[styles.shelfIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Activity size={18} color="#f59e0b" />
              </View>
              <Text style={styles.shelfLabel}>Log cardio</Text>
            </PressableScale>

            <PressableScale
              style={styles.shelfCard}
              onPress={() => setJournalSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open journal"
            >
              <View style={[styles.shelfIconCircle, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                <BookOpen size={18} color="#a855f7" />
              </View>
              <Text style={styles.shelfLabel}>Journal</Text>
            </PressableScale>
          </ScrollView>
        </View>
      </FadeIn>

      {/* 4. MIDDLE: NOURISH DAILY MACRO SPLIT */}
      {enabled.nutrition && (
        <FadeIn delay={40}>
          <Card tone="nourish" style={styles.nourishCard}>
            <View style={styles.nourishHeader}>
              <View>
                <Text style={styles.nourishEyebrow}>NOURISH · TODAY</Text>
                <Text style={styles.nourishCalories}>
                  {Math.round(macros.calories).toLocaleString()}
                  <Text style={styles.nourishCaloriesUnit}>
                    {calorieTarget ? ` / ${calorieTarget.toLocaleString()} kcal` : " kcal"}
                  </Text>
                </Text>
              </View>
              <PressableScale
                style={styles.nourishLogButton}
                onPress={() => router.push("/nutrition")}
                accessibilityRole="button"
                accessibilityLabel="Log meal"
              >
                <Plus size={16} color="#000" />
                <Text style={styles.nourishLogButtonText}>Log meal</Text>
              </PressableScale>
            </View>

            <View style={styles.macroPillRow}>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillVal}>{Math.round(macros.protein)}g</Text>
                <Text style={styles.macroPillLbl}>Protein</Text>
              </View>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillVal}>{Math.round(macros.carbs)}g</Text>
                <Text style={styles.macroPillLbl}>Carbs</Text>
              </View>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillVal}>{Math.round(macros.fat)}g</Text>
                <Text style={styles.macroPillLbl}>Fat</Text>
              </View>
            </View>
          </Card>
        </FadeIn>
      )}

      {/* 5. DAILY TARGETS */}
      <FadeIn delay={50}>
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
      </FadeIn>

      {/* 6. NORTH STAR CARD */}
      <FadeIn delay={60}>
        {northStar ? (
          <NorthStarCard
            northStar={northStar}
            onNorthStarChange={setNorthStar}
          />
        ) : (
          <NorthStarSetupCard onCreated={setNorthStar} />
        )}
      </FadeIn>

      {/* 7. RECENT ACTIVITY FEED */}
      <FadeIn delay={70}>
        <Card style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityEyebrow}>RECENT ACTIVITY</Text>
            <PressableScale
              onPress={() => router.push("/hub")}
              accessibilityRole="button"
              accessibilityLabel="See all activity"
            >
              <Text style={styles.seeAllText}>See all</Text>
            </PressableScale>
          </View>
          {topRecentEvents.length === 0 ? (
            <Text style={styles.activityEmpty}>
              No activity logged yet today. Use quick actions above to begin.
            </Text>
          ) : (
            topRecentEvents.map((evt, idx) => (
              <View
                key={evt.id}
                style={[
                  styles.activityRow,
                  idx < topRecentEvents.length - 1 && styles.activityRowDivider,
                ]}
              >
                <View style={styles.activityIconCircle}>
                  {evt.type === "workout" ? (
                    <Dumbbell size={16} color="#f59e0b" />
                  ) : (
                    <Utensils size={16} color="#10b981" />
                  )}
                </View>
                <View style={styles.activityTextGroup}>
                  <Text style={styles.activityTitle}>{evt.title}</Text>
                  <Text style={styles.activitySubtitle}>{evt.subtitle}</Text>
                </View>
                <Text style={styles.activityTime}>{formatRelativeTime(evt.timestamp)}</Text>
              </View>
            ))
          )}
        </Card>
      </FadeIn>

      {/* 8. NEXT UP (SUGGESTION) */}
      <FadeIn delay={80}>
        <PressableScale
          style={styles.suggestionCard}
          onPress={() => {
            if (suggestion.action.route) {
              router.push(suggestion.action.route as any);
            } else if (suggestion.action.type === "water") {
              void handleWaterAdd(0.25);
            } else if (suggestion.action.type === "sleep") {
              router.push("/hub");
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={`Next up: ${suggestion.text}`}
        >
          <View style={styles.suggestionLeft}>
            <View style={styles.suggestionIconCircle}>
              <Sparkles size={16} color={HOME.acc} />
            </View>
            <View style={styles.suggestionTextGroup}>
              <Text style={styles.suggestionEyebrow}>NEXT UP</Text>
              <Text style={styles.suggestionText}>{suggestion.text}</Text>
            </View>
          </View>
          <ChevronRight size={16} color={HOME.mute} />
        </PressableScale>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerGreetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HOME.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  offlineText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "600",
  },
  shelfContainer: {
    marginBottom: Spacing.two,
  },
  shelfContent: {
    gap: 10,
    paddingVertical: 2,
  },
  shelfCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: HOME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
    minHeight: 48,
  },
  shelfIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  shelfLabel: {
    color: HOME.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  nourishCard: {
    marginBottom: Spacing.two,
  },
  nourishHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  nourishEyebrow: {
    color: "#10b981",
    fontSize: Typography.caption,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  nourishCalories: {
    color: HOME.ink,
    fontSize: 26,
    fontFamily: Font.serif,
    fontWeight: "600",
    marginTop: 2,
  },
  nourishCaloriesUnit: {
    fontSize: 14,
    fontFamily: Font.sans,
    color: HOME.mute,
    fontWeight: "400",
  },
  nourishLogButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 44,
  },
  nourishLogButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },
  macroPillRow: {
    flexDirection: "row",
    gap: 8,
  },
  macroPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: HOME.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
    alignItems: "center",
  },
  macroPillVal: {
    color: HOME.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  macroPillLbl: {
    color: HOME.mute,
    fontSize: 11,
    marginTop: 2,
  },
  activityCard: {
    marginBottom: Spacing.two,
  },
  activityEyebrow: {
    color: HOME.mute,
    fontSize: Typography.caption,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: Spacing.one,
  },
  activityEmpty: {
    color: HOME.dim,
    fontSize: Typography.caption,
    paddingVertical: Spacing.one,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    minHeight: 48,
  },
  activityRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.line,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HOME.card2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  activityTextGroup: {
    flex: 1,
  },
  activityTitle: {
    color: HOME.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  activitySubtitle: {
    color: HOME.mute,
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    color: HOME.dim,
    fontSize: 12,
    marginLeft: 8,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  seeAllText: {
    color: HOME.acc,
    fontSize: 13,
    fontWeight: "500",
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: HOME.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  suggestionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212, 162, 76, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTextGroup: {
    flex: 1,
  },
  suggestionEyebrow: {
    color: HOME.acc,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  suggestionText: {
    color: HOME.ink,
    fontSize: Typography.body,
    marginTop: 2,
    lineHeight: 20,
  },
});
