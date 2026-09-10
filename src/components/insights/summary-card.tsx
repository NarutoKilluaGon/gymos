import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { buildInsightLines } from "@/services/insights";
import type { WeekInsights } from "@/types/insights";

type SummaryCardProps = {
  insights: WeekInsights;
};

function formatRange(
  startDate: string,
  endDate: string,
): string {
  const format = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(
      [],
      { month: "short", day: "numeric" },
    );

  return `${format(startDate)} – ${format(endDate)}`;
}

type Delta = {
  text: string;
  color: string;
};

function deltaText(
  current: number,
  previous: number,
  suffix: string,
  empty: string,
): Delta {
  if (current === 0 && previous === 0) {
    return { text: empty, color: GymColors.text.tertiary };
  }

  if (current === previous) {
    return {
      text: "same as last week",
      color: GymColors.text.tertiary,
    };
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";

  return {
    text: `${sign}${delta} ${suffix} vs last week`,
    color:
      delta > 0
        ? GymColors.semantic.success
        : GymColors.semantic.error,
  };
}

function weightDelta(
  current: number | null,
  previous: number | null,
  unit: string,
): string {
  if (current === null || previous === null) {
    return "no comparison";
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";

  return `${sign}${delta.toFixed(1)} ${unit} vs last week`;
}

function StatTile({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub: string;
  delta: Delta | null;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>

      <Text style={styles.tileValue}>{value}</Text>

      <Text style={styles.tileSub}>{sub}</Text>

      {delta ? (
        <Text style={[styles.tileDelta, { color: delta.color }]}>
          {delta.text}
        </Text>
      ) : (
        <Text style={styles.tileDeltaEmpty}>—</Text>
      )}
    </View>
  );
}

export function SummaryCard({
  insights,
}: SummaryCardProps) {
  const { current, previous } = insights;

  const weightUnit = current.weightUnit ?? "kg";

  const workoutDaysLabel =
    current.workoutDays === 1
      ? "1 day"
      : `${current.workoutDays} days`;

  const lines = buildInsightLines(insights);

  return (
    <GymCard>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>This week</Text>

          <Text style={styles.range}>
            {formatRange(
              current.startDate,
              current.endDate,
            )}
          </Text>
        </View>

        <Text style={styles.weekdayCount}>
          {current.workoutDays}
          <Text style={styles.weekdayCountUnit}>
            {" "}
            of 7 days active
          </Text>
        </Text>
      </View>

      <View style={styles.grid}>
        <StatTile
          label="Workouts"
          value={String(current.workouts)}
          sub={workoutDaysLabel}
          delta={deltaText(
            current.workouts,
            previous.workouts,
            "workout",
            "no training yet",
          )}
        />

        <StatTile
          label="Workout time"
          value={`${current.minutes}m`}
          sub={
            current.minutes >= 60
              ? `${Math.round(current.minutes / 60)}h total`
              : "this week"
          }
          delta={deltaText(
            current.minutes,
            previous.minutes,
            "min",
            "no training yet",
          )}
        />

        <StatTile
          label="Weight"
          value={
            current.weightLatest !== null
              ? `${current.weightLatest} ${weightUnit}`
              : "—"
          }
          sub={
            current.weightChange !== null
              ? `${current.weightChange > 0 ? "+" : ""}${current.weightChange} ${weightUnit} this week`
              : "no log this week"
          }
          delta={
            current.weightLatest !== null ||
            previous.weightLatest !== null
              ? {
                  text: weightDelta(
                    current.weightLatest,
                    previous.weightLatest,
                    weightUnit,
                  ),
                  color: GymColors.text.secondary,
                }
              : null
          }
        />

        <StatTile
          label="Avg calories"
          value={
            current.caloriesAverage !== null
              ? `${current.caloriesAverage} kcal`
              : "—"
          }
          sub={
            current.calorieDays > 0
              ? `${current.calorieDays} logged ${current.calorieDays === 1 ? "day" : "days"}`
              : "no meals logged"
          }
          delta={
            current.caloriesAverage !== null ||
            previous.caloriesAverage !== null
              ? deltaText(
                  current.caloriesAverage ?? 0,
                  previous.caloriesAverage ?? 0,
                  "kcal",
                  "no meals logged",
                )
              : null
          }
        />
      </View>

      {lines.length > 0 ? (
        <View style={styles.insights}>
          {lines.map((line, index) => (
            <Text key={index} style={styles.insightLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  range: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  weekdayCount: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  weekdayCountUnit: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "400",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.four,
    marginTop: Spacing.four,
  },

  tile: {
    width: "44%",
  },

  tileLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  tileValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
    marginTop: Spacing.one,
  },

  tileSub: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  tileDelta: {
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  tileDeltaEmpty: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  insights: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: "rgba(139, 158, 255, 0.08)",
    gap: Spacing.one,
  },

  insightLine: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 21,
  },
});