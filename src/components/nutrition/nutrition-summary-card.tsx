import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import type { MacroTotals } from "@/storage/repositories/meals";
import type { NutritionTargets } from "@/storage/repositories/nutrition-targets";

type NutritionSummaryCardProps = {
  totals: MacroTotals;
  targets: NutritionTargets;
  /**
   * S7: today's calculated target. Null when no maintenance is
   * configured — the card then shows the static `targets.calories`
   * exactly as before. Consumed calories always come from `totals`
   * (logged meals), independent of this value.
   */
  calorieTarget?: {
    value: number;
    activityKcal: number;
    adjustmentKcal: number;
  } | null;
};

export function NutritionSummaryCard({
  totals,
  targets,
  calorieTarget = null,
}: NutritionSummaryCardProps) {
  const staticTarget =
    typeof targets.calories === "number" && targets.calories > 0
      ? targets.calories
      : null;
  const displayTarget = calorieTarget?.value ?? staticTarget;
  const hasCalorieTarget =
    typeof displayTarget === "number" && displayTarget > 0;

  const consumed = Math.round(totals.calories);
  const remaining = hasCalorieTarget
    ? displayTarget! - totals.calories
    : null;

  // One-line context so the dynamic target reads as dynamic: today's
  // estimate, training's rough share, and the goal adjustment.
  const estimateParts = calorieTarget
    ? [
        "Estimated for today",
        calorieTarget.activityKcal > 0
          ? `~${Math.round(calorieTarget.activityKcal)} kcal training`
          : "updates with training",
        calorieTarget.adjustmentKcal !== 0
          ? `${calorieTarget.adjustmentKcal > 0 ? "+" : "-"}${Math.round(
              Math.abs(calorieTarget.adjustmentKcal),
            )} kcal goal`
          : null,
      ].filter((part): part is string => part !== null)
    : [];

  return (
    <GymCard style={styles.card}>
      <Text style={styles.eyebrow}>TODAY</Text>

      <View style={styles.caloriesRow}>
        <Text style={styles.caloriesValue}>{consumed}</Text>

        <Text style={styles.caloriesUnit}>
          {hasCalorieTarget ? `/ ${displayTarget} kcal` : "kcal"}
        </Text>
      </View>

      {remaining !== null && (
        <Text style={styles.remaining}>
          {remaining >= 0
            ? `${Math.round(remaining)} kcal remaining`
            : `${Math.round(-remaining)} kcal over target`}
        </Text>
      )}

      {estimateParts.length > 0 && (
        <Text style={styles.estimateNote}>
          {estimateParts.join(" · ")}
        </Text>
      )}

      <View style={styles.divider} />

      <MacroRow
        label="Protein"
        value={totals.protein}
        target={targets.protein}
      />

      <MacroRow
        label="Carbs"
        value={totals.carbs}
        target={targets.carbs}
      />

      <MacroRow
        label="Fat"
        value={totals.fat}
        target={targets.fat}
      />
    </GymCard>
  );
}

type MacroRowProps = {
  label: string;
  value: number;
  target?: number;
};

function MacroRow({ label, value, target }: MacroRowProps) {
  const hasTarget = typeof target === "number" && target > 0;

  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>

      <Text style={styles.macroValue}>
        {Math.round(value)}g
        {hasTarget ? ` / ${target}g` : ""}
      </Text>

      {hasTarget && (
        <ProgressBar current={value} target={target!} unit="g" hideHeader />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  caloriesRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.two,
  },

  caloriesValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
  },

  caloriesUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  remaining: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  estimateNote: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  divider: {
    height: 1,
    backgroundColor: GymColors.background.surface,
    marginVertical: Spacing.one,
  },

  macroRow: {
    gap: Spacing.two,
  },

  macroLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  macroValue: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
