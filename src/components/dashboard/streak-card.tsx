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
  if (compact) {
    return (
      <View
        accessibilityLabel={`Streak: ${streak} days${todayActive ? ", active" : ", at risk"}`}
        style={[
          styles.compactPill,
          todayActive ? styles.compactPillActive : styles.compactPillAtRisk,
        ]}
      >
        <Text style={styles.compactEmoji}>🔥</Text>
        <Text
          style={[
            styles.compactCount,
            todayActive ? styles.compactCountActive : styles.compactCountAtRisk,
          ]}
        >
          {streak}
        </Text>
      </View>
    );
  }

  if (streak === 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.emoji}>🔥</Text>

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

  if (!todayActive) {
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.emoji}>🔥</Text>

          <View style={styles.textBlock}>
            <Text style={styles.count}>
              {streak} {streak === 1 ? "day" : "days"}
            </Text>

            <Text style={styles.label}>
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
        <Text style={styles.emoji}>🔥</Text>

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
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: HOME.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.line,
  },
  compactPillActive: {
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  compactPillAtRisk: {
    borderColor: HOME.line,
    opacity: 0.85,
  },
  compactEmoji: {
    fontSize: 16,
  },
  compactCount: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "700",
  },
  compactCountActive: {
    color: "#f59e0b",
  },
  compactCountAtRisk: {
    color: HOME.mute,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  emoji: {
    fontSize: 28,
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
