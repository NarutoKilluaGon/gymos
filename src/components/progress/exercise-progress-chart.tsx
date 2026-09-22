import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  GymColors,
  Spacing,
  Typography,
} from "@/constants/theme";
import { convertWeight } from "@/storage/repositories/preferences";
import type { ExercisePerformance } from "@/storage/repositories/workout-progress";

type ExerciseProgressChartProps = {
  history: ExercisePerformance[];
};

const CHART_HEIGHT = 160;

export function ExerciseProgressChart({
  history,
}: ExerciseProgressChartProps) {
  const points = useMemo(() => {
    const completed = history.filter(
      (item) =>
        item.completed &&
        typeof item.weight === "number",
    );

    // Mixed kg/lb history: plot every set in the latest set's unit — the
    // same unit used for the stats and axis labels. Stored values are
    // never modified.
    const referenceUnit =
      completed.length === 0
        ? "kg"
        : completed[completed.length - 1].unit ?? "kg";

    return completed.map((item) => ({
      value: convertWeight(
        item.weight!,
        item.unit ?? "kg",
        referenceUnit,
      ),
      unit: referenceUnit,
      timestamp: item.timestamp,
    }));
  }, [history]);

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>
          No progress yet
        </Text>

        <Text style={styles.emptySubtitle}>
          Complete a set to start tracking
          this exercise.
        </Text>
      </View>
    );
  }

  const values = points.map(
    (point) => point.value,
  );

  const min = Math.min(...values);
  const max = Math.max(...values);

  const range = max - min || 1;

  const latest =
    points[points.length - 1];

  const unit = latest.unit;

  const best = Math.max(...values);

  return (
    <View>
      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>
            Latest
          </Text>

          <Text style={styles.statValue}>
            {latest.value} {unit}
          </Text>
        </View>

        <View>
          <Text style={styles.statLabel}>
            Best
          </Text>

          <Text style={styles.statValue}>
            {best} {unit}
          </Text>
        </View>
      </View>

      <View style={styles.chart}>
        <View style={styles.grid}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        <View style={styles.points}>
          {points.map((point, index) => {
            const x =
              points.length === 1
                ? 0
                : (index /
                    (points.length - 1)) *
                  100;

            const y =
              100 -
              ((point.value - min) /
                range) *
                80;

            return (
              <View
                key={`${point.timestamp}-${index}`}
                style={[
                  styles.point,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>
          {min} kg
        </Text>

        <Text style={styles.axisText}>
          {max} kg
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: Spacing.four,
  },

  emptyTitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  emptySubtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  stats: {
    flexDirection: "row",
    gap: Spacing.five,
    marginBottom: Spacing.three,
  },

  statLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  statValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "700",
    marginTop: Spacing.one,
  },

  chart: {
    height: CHART_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },

  grid: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },

  gridLine: {
    height: 1,
    backgroundColor:
      GymColors.background.surface,
  },

  points: {
    ...StyleSheet.absoluteFill,
  },

  point: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
    backgroundColor:
      GymColors.semantic.accent,
  },

  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.one,
  },

  axisText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },
});
