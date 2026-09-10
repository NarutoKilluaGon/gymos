import { StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { GoalProgress } from "@/types/insights";

type GoalProgressCardProps = {
  progress: GoalProgress | null;
};

export function GoalProgressCard({
  progress,
}: GoalProgressCardProps) {
  if (progress === null) {
    return (
      <GymCard>
        <Text style={styles.title}>Goal progress</Text>

        <Text style={styles.teaser}>
          Your North Star isn&apos;t measurable yet.
        </Text>

        <Text style={styles.teaserHint}>
          Set a target &apos;e.g. a weight or arm
          measurement&apos; from the North Star card on
          Home to track it here.
        </Text>
      </GymCard>
    );
  }

  const logged = progress.current !== null;

  return (
    <GymCard>
      <Text style={styles.eyebrow}>GOAL PROGRESS</Text>

      <Text style={styles.title}>{progress.title}</Text>

      {progress.goalTypeLabel ? (
        <Text style={styles.goalType}>
          {progress.goalTypeLabel}
        </Text>
      ) : null}

      <Text style={styles.currentLine}>
        {progress.current !== null
          ? `${progress.current}`
          : "—"}{" "}
        → {progress.target} {progress.unit}
      </Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(progress.percent, 100)}%`,
            },
          ]}
        />
      </View>

      <View style={styles.percentRow}>
        <Text style={styles.percent}>
          {logged ? `${progress.percent}%` : "0%"}
        </Text>

        <Text style={styles.percentHint}>
          {logged
            ? `on the way to ${progress.target} ${progress.unit}`
            : `no ${progress.metric} logged yet`}
        </Text>
      </View>

      {progress.why ? (
        <Text style={styles.why}>
          {progress.why}
        </Text>
      ) : null}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  goalType: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  teaser: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    marginTop: Spacing.two,
  },

  teaserHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    lineHeight: 19,
    marginTop: Spacing.one,
  },

  currentLine: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    marginTop: Spacing.three,
  },

  track: {
    height: 6,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
    overflow: "hidden",
    marginTop: Spacing.two,
  },

  fill: {
    height: "100%",
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
  },

  percentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.one,
  },

  percent: {
    color: GymColors.semantic.accent,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  percentHint: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  why: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 21,
    marginTop: Spacing.three,
  },
});