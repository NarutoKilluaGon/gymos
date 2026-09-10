import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { VolumePoint } from "@/types/insights";

type VolumeTrendCardProps = {
  points: VolumePoint[];
};

const CHART_HEIGHT = 120;

function formatVolume(volume: number): string {
  return volume >= 1000
    ? `${(volume / 1000).toFixed(1)}t`
    : `${Math.round(volume)} kg`;
}

export function VolumeTrendCard({
  points,
}: VolumeTrendCardProps) {
  const maxVolume = useMemo(
    () => Math.max(...points.map((p) => p.volume), 1),
    [points],
  );

  const current = points[points.length - 1]?.volume ?? 0;

  const peak = Math.max(...points.map((p) => p.volume), 0);

  const peakIndex = useMemo(
    () => points.findIndex((p) => p.volume === peak),
    [points, peak],
  );

  const peakLabel =
    peakIndex === -1 ? "" : points[peakIndex].label;

  return (
    <GymCard>
      <Text style={styles.title}>Volume trend</Text>

      <Text style={styles.caption}>
        Weight × reps lifted per week
      </Text>

      <View style={styles.chart}>
        {points.map((point, index) => {
          const height =
            point.volume > 0
              ? Math.max(
                  (point.volume / maxVolume) *
                    CHART_HEIGHT,
                  2,
                )
              : 0;

          const showLabel =
            index === 0 ||
            index === points.length - 1 ||
            index % 3 === 0;

          return (
            <View
              key={point.weekKey}
              style={styles.column}
            >
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      opacity:
                        point.volume === peak
                          ? 1
                          : 0.65,
                    },
                    point.volume === peak &&
                      styles.barPeak,
                  ]}
                />
              </View>

              <Text
                style={styles.axisLabel}
                numberOfLines={1}
              >
                {showLabel ? point.label : ""}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>
            This week
          </Text>

          <Text style={styles.statValue}>
            {formatVolume(current)}
          </Text>
        </View>

        <View>
          <Text style={styles.statLabel}>
            Peak week
          </Text>

          <Text style={styles.statValue}>
            {peakLabel
              ? `${formatVolume(peak)} · ${peakLabel}`
              : "—"}
          </Text>
        </View>
      </View>
    </GymCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  caption: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT + 24,
    marginTop: Spacing.four,
    gap: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor:
      GymColors.background.surface,
  },

  column: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },

  barSlot: {
    height: CHART_HEIGHT,
    justifyContent: "flex-end",
    alignItems: "center",
  },

  bar: {
    width: "72%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor:
      GymColors.semantic.accent,
  },

  barPeak: {
    backgroundColor:
      GymColors.semantic.success,
  },

  axisLabel: {
    color: GymColors.text.tertiary,
    fontSize: 9,
    textAlign: "center",
    marginTop: Spacing.one,
  },

  stats: {
    flexDirection: "row",
    gap: Spacing.five,
    marginTop: Spacing.four,
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
});