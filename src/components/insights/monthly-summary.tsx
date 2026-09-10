import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { MonthlySummary } from "@/types/insights";

type MonthlySummaryCardProps = {
  summaries: MonthlySummary[];
};

function formatMinutes(minutes: number): string {
  if (minutes === 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (rest === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${rest}m`;
}

function weightText(
  change: number | null,
  unit: string | null,
): string | null {
  if (change === null || unit === null) {
    return null;
  }

  const sign = change > 0 ? "+" : "";

  return `${sign}${change.toFixed(1)} ${unit}`;
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>

      <Text style={styles.tileValue}>{value}</Text>

      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

export function MonthlySummaryCard({
  summaries,
}: MonthlySummaryCardProps) {
  const current = summaries[summaries.length - 1];

  const weight = weightText(
    current.weightChange,
    current.weightUnit,
  );

  return (
    <GymCard>
      <Text style={styles.title}>Monthly summary</Text>

      <Text style={styles.currentMonth}>{current.label}</Text>

      <View style={styles.grid}>
        <StatTile
          label="Workouts"
          value={String(current.workouts)}
          sub={
            current.workoutDays === 1
              ? "1 active day"
              : `${current.workoutDays} active days`
          }
        />

        <StatTile
          label="Workout time"
          value={formatMinutes(current.minutes)}
          sub="this month"
        />

        <StatTile
          label="Weight change"
          value={weight ?? "—"}
          sub={
            weight
              ? "first to last weight"
              : "no weight logs"
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
        />
      </View>

      {summaries.length > 1 ? (
        <View style={styles.history}>
          {summaries
            .slice(0, -1)
            .map((month, index) => {
              const weightSuffix = weightText(
                month.weightChange,
                month.weightUnit,
              );

              return (
                <View
                  key={month.monthKey}
                  style={[
                    styles.historyRow,
                    index > 0 && styles.historyRowBorder,
                  ]}
                >
                  <Text style={styles.historyLabel}>
                    {month.label}
                  </Text>

                  <Text style={styles.historyValue}>
                    {month.workouts} workout
                    {month.workouts === 1 ? "" : "s"} ·{" "}
                    {formatMinutes(month.minutes)}
                    {weightSuffix
                      ? ` · ${weightSuffix}`
                      : ""}
                  </Text>
                </View>
              );
            })}
        </View>
      ) : null}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  currentMonth: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
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

  history: {
    marginTop: Spacing.four,
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },

  historyRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GymColors.background.card,
  },

  historyLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  historyValue: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },
});