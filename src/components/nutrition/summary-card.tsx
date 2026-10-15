import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ProgressLine } from "@/components/ds/progress-line";
import { Q } from "@/constants/quiet";
import { fmtInt } from "@/components/nutrition/summary-card-view-model";
import type { SummaryCardViewModel } from "@/components/nutrition/summary-card-view-model";

export const SummaryCard = memo(function SummaryCard({
  vm,
  onOpenMicros,
}: {
  vm: SummaryCardViewModel;
  onOpenMicros: () => void;
}) {
  const isOver = vm.calories.isOver;
  const displayNumber = vm.calories.displayNumber;

  const subtitle = vm.isEmpty
    ? `kcal budget for today. You haven't logged yet.`
    : isOver
      ? `kcal over your ${fmtInt(vm.footer.budget)} budget. You've eaten ${fmtInt(vm.footer.eaten)}.`
      : `kcal remaining of ${fmtInt(vm.footer.budget)} budget. You've eaten ${fmtInt(vm.footer.eaten)}.`;

  return (
    <View style={styles.container}>
      {/* 1. Large Calorie Number */}
      <Text
        style={[
          styles.kcalNumber,
          isOver && styles.kcalNumberOver,
        ]}
        numberOfLines={1}
      >
        {displayNumber}
      </Text>

      {/* 2. Subtitle */}
      <Text style={styles.subtitle} numberOfLines={2}>
        {subtitle}
      </Text>

      {/* 3. Progress Line with target tick and overage split */}
      <View style={styles.progressLineWrap}>
        <ProgressLine
          value={vm.footer.eaten}
          target={vm.footer.budget}
          color={Q.accent.sage}
          overColor={Q.accent.red}
          trackColor={Q.color.line}
          showTargetTick={true}
          height={2}
        />
      </View>

      {/* 4. Macro 3 Columns (Protein, Carbs, Fat) */}
      <View style={styles.macroRow}>
        {vm.macros.map((m, idx) => (
          <View
            key={m.name}
            style={[styles.macroCol, idx > 0 && styles.macroColDivider]}
          >
            <Text style={styles.macroValue}>
              {Math.round(m.eaten)}
              <Text style={styles.macroUnit}> g</Text>
            </Text>
            <Text style={styles.macroLabel}>{m.name}</Text>
          </View>
        ))}
      </View>

      {/* 5. Footer: Eaten · Budget · Burned & Micros link */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText} numberOfLines={1}>
          {vm.footer.line}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open micronutrients"
          onPress={onOpenMicros}
          hitSlop={8}
          style={styles.microsBtn}
        >
          <Text style={styles.microsText}>Micros ›</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
  },
  kcalNumber: {
    fontFamily: Q.font.displayMedium,
    fontSize: 84,
    fontWeight: "500",
    letterSpacing: -0.04 * 84,
    lineHeight: 84,
    color: Q.color.ink,
    fontVariant: ["tabular-nums"] as unknown as ("tabular-nums")[],
  },
  kcalNumberOver: {
    color: Q.accent.red,
  },
  subtitle: {
    fontFamily: Q.font.sansRegular,
    fontSize: 16,
    color: Q.color.mute,
    marginTop: 10,
    lineHeight: 22,
  },
  progressLineWrap: {
    marginTop: 14,
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: "row",
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Q.color.line,
  },
  macroCol: {
    flex: 1,
  },
  macroColDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Q.color.line,
    paddingLeft: 12,
    marginLeft: 12,
  },
  macroValue: {
    fontFamily: Q.font.displayMedium,
    fontSize: 26,
    fontWeight: "500",
    color: Q.color.ink,
    fontVariant: ["tabular-nums"] as unknown as ("tabular-nums")[],
  },
  macroUnit: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    fontWeight: "400",
    color: Q.color.mute,
  },
  macroLabel: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 40,
    paddingTop: 8,
  },
  footerText: {
    fontFamily: Q.font.sansRegular,
    color: Q.color.mute,
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  microsBtn: {
    minHeight: 40,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  microsText: {
    fontFamily: Q.font.sansSemiBold,
    color: Q.accent.sage,
    fontSize: 13,
    fontWeight: "600",
  },
});
