import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MeasurementChart } from "@/components/progress/measurement-chart";
import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { getMeasurementHistory } from "@/storage/repositories/measurements";
import type {
  Measurement,
  MeasurementType,
} from "@/types/gymos";
import type { ProgressRange } from "@/types/progress";

type MeasurementConfig = {
  type: MeasurementType;
  label: string;
};

const MEASUREMENTS: MeasurementConfig[] = [
  {
    type: "weight",
    label: "Weight",
  },
  {
    type: "biceps",
    label: "Biceps",
  },
  {
    type: "chest",
    label: "Chest",
  },
  {
    type: "waist",
    label: "Waist",
  },
  {
    type: "thigh",
    label: "Thigh",
  },
];

const RANGES: ProgressRange[] = [
  "7D",
  "30D",
  "3M",
  "6M",
  "1Y",
  "ALL",
];

function getRangeStart(
  range: ProgressRange,
): number | null {
  if (range === "ALL") {
    return null;
  }

  const now = new Date();

  switch (range) {
    case "7D":
      now.setDate(now.getDate() - 7);
      break;

    case "30D":
      now.setDate(now.getDate() - 30);
      break;

    case "3M":
      now.setMonth(now.getMonth() - 3);
      break;

    case "6M":
      now.setMonth(now.getMonth() - 6);
      break;

    case "1Y":
      now.setFullYear(now.getFullYear() - 1);
      break;
  }

  return now.getTime();
}

function filterMeasurements(
  measurements: Measurement[],
  range: ProgressRange,
): Measurement[] {
  const start = getRangeStart(range);

  if (start === null) {
    return measurements;
  }

  return measurements.filter(
    (measurement) =>
      new Date(
        measurement.timestamp,
      ).getTime() >= start,
  );
}

export default function ProgressScreen() {
  const [measurements, setMeasurements] =
    useState<Record<string, Measurement[]>>({});

  const [range, setRange] =
    useState<ProgressRange>("ALL");

  const [loading, setLoading] =
    useState(true);

  const loadProgress = useCallback(async () => {
    const results = await Promise.all(
      MEASUREMENTS.map(async (item) => {
        const history =
          await getMeasurementHistory(
            item.type,
          );

        return [item.type, history] as const;
      }),
    );

    setMeasurements(
      Object.fromEntries(results),
    );

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [loadProgress]),
  );

  const filteredMeasurements = useMemo(() => {
    const result: Record<
      string,
      Measurement[]
    > = {};

    for (const item of MEASUREMENTS) {
      result[item.type] =
        filterMeasurements(
          measurements[item.type] ?? [],
          range,
        );
    }

    return result;
  }, [measurements, range]);

  const latestMeasurements = useMemo(() => {
    const result: Record<
      string,
      Measurement | undefined
    > = {};

    for (const item of MEASUREMENTS) {
      result[item.type] =
        measurements[item.type]?.[0];
    }

    return result;
  }, [measurements]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          color={GymColors.text.primary}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>
        PROGRESS
      </Text>

      <Text style={styles.heading}>
        Your progress
      </Text>

      {/* Current snapshot */}
      <GymCard style={styles.snapshotCard}>
        <Text style={styles.snapshotTitle}>
          Current snapshot
        </Text>

        <View style={styles.snapshotGrid}>
          {MEASUREMENTS.map((item) => {
            const measurement =
              latestMeasurements[item.type];

            if (!measurement) {
              return (
                <View
                  key={item.type}
                  style={styles.snapshotItem}
                >
                  <Text style={styles.snapshotLabel}>
                    {item.label}
                  </Text>

                  <Text style={styles.snapshotEmpty}>
                    —
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={item.type}
                style={styles.snapshotItem}
              >
                <Text style={styles.snapshotLabel}>
                  {item.label}
                </Text>

                <Text style={styles.snapshotValue}>
                  {measurement.value}
                </Text>

                <Text style={styles.snapshotUnit}>
                  {measurement.unit}
                </Text>
              </View>
            );
          })}
        </View>
      </GymCard>

      <Text style={styles.sectionLabel}>
        TREND
      </Text>

      <View style={styles.rangeSelector}>
        {RANGES.map((item) => {
          const selected = item === range;

          return (
            <Pressable
              key={item}
              onPress={() => setRange(item)}
              style={[
                styles.rangeButton,
                selected &&
                  styles.rangeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  selected &&
                    styles.rangeTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {MEASUREMENTS.map((item) => {
          const history =
            filteredMeasurements[item.type] ??
            [];

          const hasHistoricalData =
            (measurements[item.type] ?? [])
              .length > 0;

          return (
            <GymCard
              key={item.type}
              style={styles.card}
            >
              <Text style={styles.label}>
                {item.label}
              </Text>

              <MeasurementChart
                measurements={history}
                hasHistoricalData={
                  hasHistoricalData
                }
              />
            </GymCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      GymColors.background.primary,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      GymColors.background.primary,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  heading: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  snapshotCard: {
    marginBottom: Spacing.four,
  },

  snapshotTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.three,
  },

  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },

  snapshotItem: {
    width: "28%",
  },

  snapshotLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  snapshotValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  snapshotUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  snapshotEmpty: {
    color: GymColors.text.tertiary,
    fontSize: Typography.h2,
  },

  sectionLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  rangeSelector: {
    flexDirection: "row",
    backgroundColor:
      GymColors.background.card,
    borderRadius: Radius.medium,
    padding: 4,
    marginBottom: Spacing.four,
  },

  rangeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
  },

  rangeButtonSelected: {
    backgroundColor:
      GymColors.background.surface,
  },

  rangeText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  rangeTextSelected: {
    color: GymColors.text.primary,
  },

  list: {
    gap: Spacing.two,
  },

  card: {
    marginBottom: 0,
  },

  label: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },
});