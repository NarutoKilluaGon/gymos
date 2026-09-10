import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { findCardioActivity } from "@/data/cardio";
import type { CardioEntry } from "@/types/gymos";

type CardioCardProps = {
  entry: CardioEntry;
  onDelete: () => void;
};

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const remaining = min % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDistance(km?: number): string {
  if (km === undefined) return "";
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

export function CardioCard({ entry, onDelete }: CardioCardProps) {
  const activity = findCardioActivity(entry.activity);
  const label = entry.activity === "custom" && entry.name ? entry.name : activity?.label ?? "Cardio";

  const metrics = [
    formatDuration(entry.durationMin),
    formatDistance(entry.distanceKm),
    entry.calories !== undefined ? `${entry.calories} kcal` : "",
  ].filter(Boolean);

  return (
    <GymCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.emoji}>{activity?.emoji ?? "🏷️"}</Text>

          <View style={styles.titleWrap}>
            <Text style={styles.name}>{label}</Text>

            <Text style={styles.meta}>{metrics.join(" · ")}</Text>
          </View>
        </View>

        <Pressable
          onPress={onDelete}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
        >
          <Text style={styles.deleteText}>×</Text>
        </Pressable>
      </View>
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },

  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  titleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    flex: 1,
  },

  emoji: {
    fontSize: 22,
  },

  titleWrap: {
    flex: 1,
  },

  name: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  meta: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
  },

  deleteText: {
    color: GymColors.text.secondary,
    fontSize: 24,
    fontWeight: "300",
  },
});