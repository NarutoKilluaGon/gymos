import { Flame } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ds/card";
import { Font, HOME } from "@/constants/design";
import { Spacing, Typography } from "@/constants/theme";

type StreakCardProps = {
  streak: number;
  todayActive?: boolean;
  compact?: boolean;
};

export function StreakCard({
  streak,
  todayActive = true,
  compact = false,
}: StreakCardProps) {
  const isNone = streak === 0;
  const isAtRisk = streak > 0 && !todayActive;
  const isActive = streak > 0 && todayActive;

  if (compact) {
    const flameColor = isNone
      ? HOME.dim
      : isAtRisk
        ? "#e0803f"
        : "#d4a24c";

    const countColor = isNone
      ? HOME.dim
      : isAtRisk
        ? "#e0803f"
        : "#d4a24c";

    return (
      <View
        accessibilityLabel={`Streak: ${streak} days${isNone ? ", none" : isActive ? ", active" : ", at risk"}`}
        style={[
          styles.compactPill,
          isActive && styles.compactPillActive,
          isAtRisk && styles.compactPillAtRisk,
          isNone && styles.compactPillNone,
        ]}
      >
        <Flame size={15} color={flameColor} />
        <Text style={[styles.compactCount, { color: countColor }]}>
          {streak}
        </Text>
      </View>
    );
  }

  if (isNone) {
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: HOME.card2 }]}>
            <Flame size={20} color={HOME.mute} />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.label}>No streak yet</Text>

            <Text style={styles.hint}>
              Log any activity today to start one.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  if (isAtRisk) {
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(224, 128, 63, 0.15)" }]}>
            <Flame size={20} color="#e0803f" />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.count}>
              {streak} {streak === 1 ? "day" : "days"}
            </Text>

            <Text style={[styles.label, { color: "#e0803f" }]}>
              At risk — log today to keep it
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(212, 162, 76, 0.15)" }]}>
          <Flame size={20} color="#d4a24c" />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.count}>
            {streak} {streak === 1 ? "day" : "days"}
          </Text>

          <Text style={styles.label}>
            {streak < 7
              ? "Keep it going!"
              : streak < 30
                ? "On fire!"
                : "Unstoppable!"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },
  compactPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: HOME.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
  },
  compactPillActive: {
    borderColor: "rgba(212, 162, 76, 0.4)",
    backgroundColor: "rgba(212, 162, 76, 0.12)",
  },
  compactPillAtRisk: {
    borderColor: "rgba(224, 128, 63, 0.4)",
    backgroundColor: "rgba(224, 128, 63, 0.12)",
  },
  compactPillNone: {
    borderColor: HOME.line,
    opacity: 0.7,
  },
  compactCount: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
  },
  count: {
    color: HOME.ink,
    fontSize: Typography.h2,
    fontWeight: "700",
  },
  label: {
    color: HOME.mute,
    fontSize: Typography.caption,
    marginTop: 2,
  },
  hint: {
    color: HOME.dim,
    fontSize: Typography.caption,
    marginTop: 2,
  },
});
