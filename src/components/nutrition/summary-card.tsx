import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Bar, NCard, Ring } from "@/components/nutrition/nourish-ui";
import { N, NRadius, NSerif } from "@/constants/nourish-theme";
import type { SummaryCardViewModel } from "@/components/nutrition/summary-card-view-model";

export const SummaryCard = memo(function SummaryCard({
  vm,
  onOpenMicros,
}: {
  vm: SummaryCardViewModel;
  onOpenMicros: () => void;
}) {
  return (
    <NCard style={styles.card}>
      <View style={styles.mainRow}>
        {/* Left side: 96dp ring with visible track */}
        <View style={styles.ringWrapper}>
          <Ring
            value={vm.footer.eaten}
            max={vm.footer.budget}
            size={96}
            strokeWidth={8}
          >
            <Text
              style={[
                styles.kcalNumber,
                { fontSize: vm.calories.fontSize },
                vm.calories.isOver && { color: N.bad },
              ]}
              numberOfLines={1}
            >
              {vm.calories.displayNumber}
            </Text>
            <Text
              style={[
                styles.kcalLabel,
                vm.calories.isOver && { color: N.bad },
              ]}
            >
              {vm.calories.displayLabel}
            </Text>
          </Ring>
        </View>

        {/* Right side: 3 macro rows (Protein, Carbs, Fat) */}
        <View style={styles.macroCol}>
          {vm.macros.map((m) => (
            <View key={m.name} style={styles.macroRow}>
              <View style={styles.macroHead}>
                <Text style={styles.macroName}>{m.name}</Text>
                <Text style={[styles.macroRemaining, m.isOver && { color: N.bad }]}>
                  {m.displayRemaining}
                </Text>
              </View>
              <Bar value={m.eaten} max={m.target} color={m.color} height={6} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Footer: Eaten X (±uncertainty if present) · Budget Y · Burned Z and Micros › */}
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
    </NCard>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: NRadius.card,
    marginBottom: 12,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ringWrapper: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  kcalNumber: {
    fontFamily: NSerif,
    fontWeight: "300",
    color: N.ink,
    textAlign: "center",
  },
  kcalLabel: {
    color: N.mute,
    fontSize: 11,
    marginTop: 1,
    textAlign: "center",
  },
  macroCol: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  macroRow: {
    gap: 3,
  },
  macroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroName: {
    color: N.ink,
    fontSize: 12,
    fontWeight: "500",
  },
  macroRemaining: {
    color: N.mute,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: N.line,
    marginTop: 12,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  footerText: {
    color: N.mute,
    fontSize: 11,
    flex: 1,
    paddingRight: 8,
  },
  microsBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  microsText: {
    color: N.acc,
    fontSize: 12,
    fontWeight: "600",
  },
});
