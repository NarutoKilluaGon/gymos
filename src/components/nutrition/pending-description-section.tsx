import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { PendingDescriptionAnalysis } from "@/storage/repositories/description-ai-queue";

type PendingDescriptionSectionProps = {
  items: PendingDescriptionAnalysis[];
  retryingId: string | null;
  onRetry: (item: PendingDescriptionAnalysis) => void;
};

export function PendingDescriptionSection({
  items,
  retryingId,
  onRetry,
}: PendingDescriptionSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <GymCard style={styles.card}>
      <Text style={styles.title}>
        {`Pending analysis (${items.length})`}
      </Text>

      {items.map((item) => {
        const pending = item.status === "pending";

        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>

              <Text style={styles.state}>
                {pending
                  ? "Offline · waiting to estimate"
                  : "Needs attention · retry available"}
              </Text>
            </View>

            <Pressable
              onPress={() => onRetry(item)}
              disabled={retryingId !== null}
              style={[
                styles.retryButton,
                retryingId !== null && styles.retryButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Retry analysis for ${item.description}`}
            >
              <Text style={styles.retryText}>
                {retryingId === item.id ? "Retrying…" : "Retry"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </GymCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GymColors.background.surface,
    paddingTop: Spacing.two,
  },

  copy: {
    flex: 1,
    gap: Spacing.half,
  },

  description: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  state: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  retryButton: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  retryButtonDisabled: {
    opacity: 0.5,
  },

  retryText: {
    color: GymColors.semantic.accent,
    fontSize: Typography.caption,
    fontWeight: "700",
  },
});
