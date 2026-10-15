import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { DAILY_TARGETS } from "@/constants/targets";
import { formatNumber } from "@/utils/format";
import {
  getStepPermissionStatus,
  requestStepPermission,
  startStepTracking,
  type StepPermissionStatus,
} from "@/services/steps";

type DailyTargetsCardProps = {
  water: number;
  mealsLogged: number;
  sleep?: string;
  protein?: number;
  proteinTarget?: number;
  steps?: number;
  stepsTarget?: number;
  stepStatus?: StepPermissionStatus;
  onStepPermissionChange?: (status: StepPermissionStatus) => void;
  supplementsTaken?: number;
  supplementsTotal?: number;
  nutritionEnabled?: boolean;
  showNutrition?: boolean;
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
  stepStatus,
  onStepPermissionChange,
  supplementsTaken,
  supplementsTotal,
  nutritionEnabled = true,
  showNutrition,
  onEditTargets,
  onSupplementsPress,
  onSleepDeleteLongPress,
  compact = false,
}: DailyTargetsCardProps) {
  const [internalStepStatus, setInternalStepStatus] = useState<StepPermissionStatus>(
    stepStatus ?? "not_granted",
  );
  const effectiveStepStatus = stepStatus ?? internalStepStatus;

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      const s = await getStepPermissionStatus();
      if (isMounted) {
        setInternalStepStatus(s);
        onStepPermissionChange?.(s);
        if (s === "granted") {
          void startStepTracking();
        }
      }
    }

    if (!stepStatus) {
      void checkStatus();
    }

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && !stepStatus) {
        void checkStatus();
      }
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [stepStatus, onStepPermissionChange]);

  async function handleEnableSteps() {
    const result = await requestStepPermission();
    setInternalStepStatus(result);
    onStepPermissionChange?.(result);
  }

  function handleOpenSettings() {
    void Linking.openSettings();
  }

  const shouldShowNutrition = showNutrition ?? !nutritionEnabled;
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
      label="Water"
      current={water}
      target={DAILY_TARGETS.waterL}
      unit="L"
      compact={compact}
    />
  );

  // Protein - only shown when Nourish card is not present on screen
  if (shouldShowNutrition) {
    if (hasProteinTarget) {
      items.push(
        <ProgressBar
          key="protein"
          label="Protein"
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
          value={`${formatNumber(Math.round(protein ?? 0))}g`}
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
  if (effectiveStepStatus === "unavailable") {
    items.push(
      <TargetRow
        key="steps"
        label="Steps"
        value="Steps not supported on this phone"
        muted
        compact={compact}
      />
    );
  } else if (effectiveStepStatus === "granted") {
    if (typeof stepsTarget === "number" && stepsTarget > 0) {
      items.push(
        <ProgressBar
          key="steps"
          label="Steps"
          current={steps ?? 0}
          target={stepsTarget}
          unit="steps (since you opened the app)"
          compact={compact}
        />
      );
    } else {
      items.push(
        <TargetRow
          key="steps"
          label="Steps"
          value={`${formatNumber(steps ?? 0)} steps (since you opened the app)`}
          compact={compact}
        />
      );
    }
  } else {
    // "not_granted" or "blocked"
    const isBlocked = effectiveStepStatus === "blocked";
    const buttonLabel = isBlocked ? "Open settings" : "Enable step tracking";

    items.push(
      <View
        key="steps"
        style={[
          styles.row,
          compact && styles.rowCompact,
          styles.stepPermissionRow,
        ]}
      >
        <Text style={[styles.label, compact && styles.labelCompact]}>Steps</Text>

        <Pressable
          onPress={isBlocked ? handleOpenSettings : handleEnableSteps}
          style={styles.stepPermissionButton}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          <Text style={styles.stepPermissionButtonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    );
  }

  // Meals logged
  if (shouldShowNutrition) {
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
            label="Supplements"
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

  stepPermissionRow: {
    minHeight: 44,
  },

  stepPermissionButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: "rgba(242, 196, 109, 0.12)",
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: "rgba(242, 196, 109, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  stepPermissionButtonText: {
    color: "#f2c46d",
    fontSize: Typography.caption,
    fontWeight: "600",
  },
});