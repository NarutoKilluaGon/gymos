import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import { Card } from "@/components/ds/card";
import { Chip } from "@/components/ds/chip";
import { Font } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { displayName } from "@/utils/format";

export type CardioEntry = {
  id: string;
  name: string;
  detail?: string;
  kcal?: number;
  durationMin?: number;
  removable?: boolean;
};

export type CardioSectionProps = {
  entries: CardioEntry[];
  onAddPress: () => void;
  onRemovePress?: (entry: CardioEntry, index: number) => void;
  emptyText?: string;
  cardStyle?: boolean;
};

export function CardioSection({
  entries,
  onAddPress,
  onRemovePress,
  emptyText = "Log cardio to track calories burned.",
  cardStyle = true,
}: CardioSectionProps) {
  const theme = useTheme();

  const content = (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>Cardio</Text>
        <Chip
          label="Cardio"
          icon={<Plus size={14} color={theme.ink} />}
          onPress={onAddPress}
          accessibilityLabel="Log cardio"
        />
      </View>

      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: theme.mute }]}>{emptyText}</Text>
      ) : (
        <View style={styles.list}>
          {entries.map((entry, index) => {
            const subtitle = [
              entry.detail,
              entry.durationMin && !entry.detail?.includes("min")
                ? `${entry.durationMin} min`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <View
                key={entry.id}
                style={[
                  styles.entryRow,
                  index < entries.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.line,
                  },
                ]}
              >
                <View style={styles.entryInfo}>
                  <Text style={[styles.entryName, { color: theme.ink }]} numberOfLines={1}>
                    {displayName(entry.name)}
                  </Text>
                  {subtitle ? (
                    <Text style={[styles.entryMeta, { color: theme.mute }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                {entry.kcal !== undefined ? (
                  <Text style={[styles.entryKcal, { color: theme.ink }]}>
                    {Math.round(entry.kcal)} kcal
                  </Text>
                ) : null}

                {entry.removable !== false && onRemovePress ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.name}`}
                    hitSlop={10}
                    style={styles.removeBtn}
                    onPress={() => onRemovePress(entry, index)}
                  >
                    <Text style={[styles.removeText, { color: theme.dim }]}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  if (cardStyle) {
    return <Card style={styles.card}>{content}</Card>;
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  card: {
    gap: 8,
    marginVertical: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontFamily: Font.serif,
    fontSize: 20,
    fontWeight: "300",
  },
  empty: {
    fontSize: 14,
    paddingVertical: 4,
  },
  list: {
    overflow: "hidden",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 10,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: "500",
  },
  entryMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  entryKcal: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeText: {
    fontSize: 16,
  },
});
