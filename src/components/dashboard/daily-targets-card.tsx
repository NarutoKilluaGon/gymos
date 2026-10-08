import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import { DAILY_TARGETS } from "@/constants/targets";

type DailyTargetsCardProps = {
  water: number;
  mealsLogged: number;
  sleep?: string;
  protein?: number;
  proteinTarget?: number;
  steps?: number;
  stepsTarget?: number;
  supplementsTaken?: number;
  supplementsTotal?: number;
  nutritionEnabled?: boolean;
  onEditTargets?: () => void;
  onSupplementsPress?: () => void;
  onSleepDeleteLongPress?: () => void;
  compact?: boolean;
};

export function DailyTargetsCard({
  water,
  mealsLogged,
  sleep,
  protein,
  proteinTarget,
  steps,
  stepsTarget,
  supplementsTaken,
  supplementsTotal,
  nutritionEnabled = true,
  onEditTargets,
  onSupplementsPress,
  onSleepDeleteLongPress,
  compact = false,
}: DailyTargetsCardProps) {
  const hasProteinTarget =
    typeof proteinTarget === "number" && proteinTarget > 0;

  const allEmpty =
    water === 0 &&
    mealsLogged === 0 &&
    !sleep &&
    !protein &&
    !steps &&
    (supplementsTotal === undefined || supplementsTotal === 0);

  // Build items array for compact grid layout
  const items: React.ReactNode[] = [];

  // Water - always shown
  items.push(
    <ProgressBar
      key="water"
      current={water}
      target={DAILY_TARGETS.waterL}
      unit="L"
      compact={compact}
    />
  );

  // Protein - either progress bar or target row
  if (nutritionEnabled) {
    if (hasProteinTarget) {
      items.push(
        <ProgressBar
          key="protein"
          current={protein ?? 0}
          target={proteinTarget}
          unit="g"
          compact={compact}
        />
      );
    } else {
      items.push(
        <TargetRow
          key="protein"
          label="Protein"
          value={`${Math.round(protein ?? 0)}g`}
          compact={compact}
        />
      );
    }
  }

  // Sleep
  const sleepRow = (
    <TargetRow
      key="sleep"
      label="Sleep"
      value={sleep ?? "—"}
      compact={compact}
    />
  );

  items.push(
    onSleepDeleteLongPress && sleep ? (
      <Pressable
        key="sleep"
        onLongPress={onSleepDeleteLongPress}
        style={styles.sleepRow}
        accessibilityRole="button"
        accessibilityHint="Long press to delete today's sleep log"
      >
        {sleepRow}
      </Pressable>
    ) : (
      sleepRow
    ),
  );

  // Steps
  if (typeof steps === "number") {
    if (typeof stepsTarget === "number" && stepsTarget > 0) {
      items.push(
        <ProgressBar
          key="steps"
          current={steps}
          target={stepsTarget}
          unit="steps"
          compact={compact}
        />
      );
    } else {
      items.push(
        <TargetRow
          key="steps"
          label="Steps"
          value={steps.toLocaleString()}
          compact={compact}
        />
      );
    }
  }

  // Meals logged
  if (nutritionEnabled) {
    items.push(
      <TargetRow
        key="meals"
        label="Meals logged"
        value={String(mealsLogged)}
        compact={compact}
      />
    );
  }

  // Supplements
  if (typeof supplementsTotal === "number" && supplementsTotal > 0) {
    items.push(
      <Pressable
        key="supplements"
        onPress={onSupplementsPress}
        style={styles.supplementRow}
        accessibilityRole="button"
        accessibilityLabel="Open supplement log"
      >
        {supplementsTaken === 0 ? (
          <TargetRow
            label="Supplements"
            value={`0 / ${supplementsTotal} taken`}
            muted
            compact={compact}
          />
        ) : (
          <ProgressBar
            current={supplementsTaken ?? 0}
            target={supplementsTotal}
            unit="taken"
            compact={compact}
          />
        )}
      </Pressable>
    );
  }

  return (
    <GymCard style={styles.card}>
      <Text style={styles.eyebrow}>DAILY TARGETS</Text>

      {compact ? (
        <View style={styles.compactGrid}>{items}</View>
      ) : (
        <>
          {items}
          {allEmpty && (
            <Text style={styles.emptyHint}>
              Log your first water, meal, or measurement to start filling
              today&apos;s targets.
            </Text>
          )}

          {onEditTargets && (
            <Pressable
              onPress={onEditTargets}
              style={styles.editRow}
              accessibilityRole="button"
              accessibilityLabel="Edit targets"
            >
              <Text style={styles.editText}>Edit targets</Text>
            </Pressable>
          )}
        </>
      )}
    </GymCard>
  );
}

type TargetRowProps = {
  label: string;
  value: string;
  muted?: boolean;
  compact?: boolean;
};

function TargetRow({ label, value, muted, compact = false }: TargetRowProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <Text style={[styles.value, muted && styles.valueMuted, compact && styles.valueCompact]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  compactGrid: {
    flexDirection: "column",
    gap: Spacing.one,
    marginTop: Spacing.one,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.one,
    minHeight: 36,
    width: "100%",
  },

  rowCompact: {
    width: "100%",
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },

  label: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
  },

  labelCompact: {
    fontSize: Typography.caption,
    color: GymColors.text.tertiary,
  },

  value: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  valueCompact: {
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  valueMuted: {
    color: GymColors.text.tertiary,
  },

  emptyHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    lineHeight: 18,
    marginTop: Spacing.two,
  },

  supplementRow: {
    paddingVertical: Spacing.one,
    width: "100%",
  },

  sleepRow: {
    paddingVertical: Spacing.one,
    width: "100%",
  },

  editRow: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    alignItems: "center",
  },

  editText: {
    color: GymColors.semantic.accent,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
});