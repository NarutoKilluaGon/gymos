import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GoalProgressCard } from "@/components/insights/goal-progress";
import { Heatmap } from "@/components/insights/heatmap";
import { MonthlySummaryCard } from "@/components/insights/monthly-summary";
import { SummaryCard } from "@/components/insights/summary-card";
import { VolumeTrendCard } from "@/components/insights/volume-trend-card";
import { GymCard } from "@/components/ui/gym-card";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  getHeatmap,
  getMonthlySummaries,
  getNorthStarProgress,
  getVolumeTrend,
  getWeekInsights,
} from "@/services/insights";
import { showToast } from "@/utils/toast";
import type {
  GoalProgress,
  HeatmapWeek,
  MonthlySummary,
  VolumePoint,
  WeekInsights,
} from "@/types/insights";

type InsightsSheetProps = {
  onClose: () => void;
};

export function InsightsSheet({
  onClose,
}: InsightsSheetProps) {
  const [heatmap, setHeatmap] = useState<
    HeatmapWeek[]
  >([]);
  const [insights, setInsights] =
    useState<WeekInsights | null>(null);
  const [monthlies, setMonthlies] = useState<
    MonthlySummary[]
  >([]);
  const [goalProgress, setGoalProgress] =
    useState<GoalProgress | null>();
  const [volume, setVolume] = useState<
    VolumePoint[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [weeks, weekInsights, summaries, goal, trend] =
          await Promise.all([
            getHeatmap(),
            getWeekInsights(),
            getMonthlySummaries(),
            getNorthStarProgress(),
            getVolumeTrend(),
          ]);

        if (cancelled) return;

        setHeatmap(weeks);
        setInsights(weekInsights);
        setMonthlies(summaries);
        setGoalProgress(goal);
        setVolume(trend);
      } catch {
        showToast("Couldn't load insights");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasAnyWorkout =
    (insights?.current.workouts ?? 0) > 0 ||
    (insights?.previous.workouts ?? 0) > 0;

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>

        <Text style={styles.subtitle}>
          Your consistency at a glance
        </Text>
      </View>

      {loading ? (
        <View style={styles.body}>
          <Skeleton height={180} style={styles.skeletonCard} />

          <SkeletonList count={3} height={80} />
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {goalProgress !== undefined ? (
            <GoalProgressCard progress={goalProgress} />
          ) : null}

          {hasAnyWorkout ? (
            <>
              <GymCard>
                <Text style={styles.cardTitle}>
                  Workout consistency
                </Text>

                <Text style={styles.cardCaption}>
                  Last 17 weeks · darker means more
                  workouts
                </Text>

                <View style={styles.heatmapWrap}>
                  <Heatmap weeks={heatmap} />
                </View>
              </GymCard>

              {insights ? (
                <SummaryCard insights={insights} />
              ) : null}

              <VolumeTrendCard points={volume} />

              {monthlies.length > 0 ? (
                <MonthlySummaryCard summaries={monthlies} />
              ) : null}
            </>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>
                No workouts yet
              </Text>

              <Text style={styles.emptyText}>
                Complete your first workout and
                this summary will start tracking
                your consistency.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    height: "88%",
    paddingTop: Spacing.three,
  },

  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.half,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },

  scrollContent: {
    gap: Spacing.three,
  },

  skeletonCard: {
    marginBottom: Spacing.three,
  },

  cardTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },

  cardCaption: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  heatmapWrap: {
    marginTop: Spacing.three,
  },

  emptyBlock: {
    alignItems: "center",
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "700",
    marginBottom: Spacing.two,
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});