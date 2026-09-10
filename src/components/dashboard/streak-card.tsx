import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Spacing, Typography } from "@/constants/theme";

type StreakCardProps = {
  streak: number;
};

export function StreakCard({ streak }: StreakCardProps) {
  if (streak === 0) {
    return (
      <GymCard style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.emoji}>🔥</Text>

          <View style={styles.textBlock}>
            <Text style={styles.label}>No streak yet</Text>

            <Text style={styles.hint}>
              Log any activity today to start one.
            </Text>
          </View>
        </View>
      </GymCard>
    );
  }

  return (
    <GymCard style={styles.card}>
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
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
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
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  label: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: 2,
  },

  hint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: 2,
  },
});
