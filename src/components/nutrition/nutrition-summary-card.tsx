import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import type { MacroTotals } from "@/storage/repositories/meals";
import type { NutritionTargets } from "@/storage/repositories/nutrition-targets";

type NutritionSummaryCardProps = {
  totals: MacroTotals;
  targets: NutritionTargets;
};

export function NutritionSummaryCard({
  totals,
  targets,
}: NutritionSummaryCardProps) {
  const hasCalorieTarget =
    typeof targets.calories === "number" &&
    targets.calories > 0;

  return (
    <GymCard style={styles.card}>
      <Text style={styles.eyebrow}>TODAY</Text>

      <View style={styles.caloriesRow}>
        <Text style={styles.caloriesValue}>
          {Math.round(totals.calories)}
        </Text>

        <Text style={styles.caloriesUnit}>
          kcal {hasCalorieTarget ? `/ ${targets.calories}` : ""}
        </Text>
      </View>

      {hasCalorieTarget && (
        <ProgressBar
          current={totals.calories}
          target={targets.calories!}
          unit="kcal"
        />
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
        <ProgressBar current={value} target={target!} unit="g" />
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
    fontSize: Typography.display,
    fontWeight: "700",
  },

  caloriesUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
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
