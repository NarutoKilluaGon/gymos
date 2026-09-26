import { StyleSheet, Text, View } from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { progressPercent } from "@/services/meal-estimator";

export type NutritionProcessingStatus = "active" | "done";

type NutritionProcessingProgressProps = {
  /** Current stage label, e.g. "Finding nutrition". */
  label: string;
  /** Honest stage detail, e.g. "3 of 5" — or "Step 2 of 3". */
  detail?: string;
  /** Completed work units; percentage is always derived from these. */
  current: number;
  /** Total work units for the operation. */
  total: number;
  status?: NutritionProcessingStatus;
};

/**
 * Determinate progress for Nutrition processing (local description
 * resolution, food adds, totals). The bar and percentage always derive
 * from `current / total` — real completed work, never arbitrary values.
 * Restrained visual language: same tokens as the rest of GymOS.
 */
export function NutritionProcessingProgress({
  label,
  detail,
  current,
  total,
  status = "active",
}: NutritionProcessingProgressProps) {
  const percent = progressPercent(current, total);
  const done = status === "done" || percent >= 100;

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}, ${percent} percent`}
    >
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>

        <Text style={styles.percent}>{done ? "Done" : `${percent}%`}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%` },
            done && styles.fillDone,
          ]}
        />
      </View>

      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  label: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  percent: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  track: {
    height: 8,
    borderRadius: Radius.small,
    backgroundColor: GymColors.background.surface,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.small,
  },

  fillDone: {
    backgroundColor: GymColors.semantic.success,
  },

  detail: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },
});
