import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { GymColors, Spacing, Typography } from "@/constants/theme";
import { convertWeight, type WeightUnit } from "@/storage/repositories/preferences";
import type { Measurement } from "@/types/gymos";

type MeasurementChartProps = {
  measurements: Measurement[];
  height?: number;
  hasHistoricalData?: boolean;
};

const CHART_WIDTH = 320;
const PADDING_LEFT = 42;
const PADDING_RIGHT = 12;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 28;

export function MeasurementChart({
  measurements,
  height = 180,
  hasHistoricalData = false,
}: MeasurementChartProps) {
  const chart = useMemo(() => {
    if (measurements.length === 0) {
      return null;
    }

    // Mixed kg/lb history: plot every reading in the latest reading's
    // unit (the one shown next to CURRENT) so the line and the CHANGE
    // are coherent. Stored values are never modified. Non-weight charts
    // share one unit across the series, so convertWeight is an identity.
    const referenceUnit =
      measurements[measurements.length - 1].unit;

    const values = measurements.map((measurement) =>
      convertWeight(
        measurement.value,
        measurement.unit as WeightUnit,
        referenceUnit as WeightUnit,
      ),
    );

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const range = maxValue - minValue;

    const padding = range === 0 ? Math.max(maxValue * 0.05, 1) : range * 0.15;

    const minY = minValue - padding;
    const maxY = maxValue + padding;

    const chartWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;

    const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;

    const points = measurements.map((measurement, index) => {
      const x =
        measurements.length === 1
          ? PADDING_LEFT + chartWidth / 2
          : PADDING_LEFT + (index / (measurements.length - 1)) * chartWidth;

      const normalized = (values[index] - minY) / (maxY - minY);

      const y = PADDING_TOP + chartHeight - normalized * chartHeight;

      return {
        x,
        y,
        value: values[index],
      };
    });

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return {
      points,
      path,
      minY,
      maxY,
    };
  }, [measurements, height]);

  if (!chart) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {hasHistoricalData
            ? "No measurements in this period"
            : "No measurements yet"}
        </Text>

        <Text style={styles.emptySubtext}>
          {hasHistoricalData
            ? "Try a longer time range."
            : "Keep logging measurements to see your progress here."}
        </Text>
      </View>
    );
  }

  const firstMeasurement = measurements[0];
  const lastMeasurement = measurements[measurements.length - 1];

  const change =
    chart.points[chart.points.length - 1].value -
    chart.points[0].value;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View>
          <Text style={styles.currentLabel}>CURRENT</Text>

          <Text style={styles.currentValue}>
            {lastMeasurement.value} {lastMeasurement.unit}
          </Text>
        </View>

        {measurements.length >= 2 && (
          <View style={styles.changeContainer}>
            <Text style={styles.currentLabel}>CHANGE</Text>

            <Text style={styles.change}>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)} {lastMeasurement.unit}
            </Text>
          </View>
        )}
      </View>

      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      >
        <Line
          x1={PADDING_LEFT}
          y1={PADDING_TOP}
          x2={CHART_WIDTH - PADDING_RIGHT}
          y2={PADDING_TOP}
          stroke={GymColors.background.card}
          strokeWidth={1}
        />

        <Line
          x1={PADDING_LEFT}
          y1={height - PADDING_BOTTOM}
          x2={CHART_WIDTH - PADDING_RIGHT}
          y2={height - PADDING_BOTTOM}
          stroke={GymColors.background.card}
          strokeWidth={1}
        />

        <SvgText
          x={PADDING_LEFT - 8}
          y={PADDING_TOP + 4}
          fill={GymColors.text.tertiary}
          fontSize={10}
          textAnchor="end"
        >
          {chart.maxY.toFixed(1)}
        </SvgText>

        <SvgText
          x={PADDING_LEFT - 8}
          y={height - PADDING_BOTTOM + 4}
          fill={GymColors.text.tertiary}
          fontSize={10}
          textAnchor="end"
        >
          {chart.minY.toFixed(1)}
        </SvgText>

        <Path
          d={chart.path}
          fill="none"
          stroke={GymColors.semantic.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.points.map((point, index) => (
          <Circle
            key={`${point.x}-${point.y}-${index}`}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={GymColors.semantic.accent}
          />
        ))}

        {measurements.length >= 1 && (
          <SvgText
            x={chart.points[0].x}
            y={height - 8}
            fill={GymColors.text.tertiary}
            fontSize={9}
            textAnchor="middle"
          >
            {formatDate(firstMeasurement.timestamp)}
          </SvgText>
        )}

        {measurements.length >= 2 && (
          <SvgText
            x={chart.points[chart.points.length - 1].x}
            y={height - 8}
            fill={GymColors.text.tertiary}
            fontSize={9}
            textAnchor="middle"
          >
            {formatDate(lastMeasurement.timestamp)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.two,
  },

  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: Spacing.one,
  },

  currentLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: 2,
  },

  currentValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  changeContainer: {
    alignItems: "flex-end",
  },

  change: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: Spacing.four,
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  emptySubtext: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },
});
