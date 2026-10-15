import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Q } from "@/constants/quiet";
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
  accentColor?: string;
  cardStyle?: boolean;
};

export function CardioSection({
  entries,
  onAddPress,
  onRemovePress,
  emptyText = "Log cardio to track calories burned.",
  accentColor = Q.accent.ember,
}: CardioSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cardio</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log cardio"
          hitSlop={8}
          style={styles.addBtn}
          onPress={onAddPress}
        >
          <Text style={[styles.addText, { color: accentColor }]}>+ Cardio</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
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
                  index > 0 && styles.entryRowBorder,
                ]}
              >
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName} numberOfLines={1}>
                    {displayName(entry.name)}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.entryMeta} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                {entry.kcal !== undefined ? (
                  <Text style={styles.entryKcal}>
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
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
    fontWeight: "400",
  },
  addBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  addText: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    fontFamily: Q.font.sansRegular,
    fontSize: 14,
    color: Q.color.mute,
    paddingVertical: 4,
  },
  list: {
    overflow: "hidden",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    gap: 12,
  },
  entryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontFamily: Q.font.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    color: Q.color.ink,
  },
  entryMeta: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
    marginTop: 2,
  },
  entryKcal: {
    fontFamily: Q.font.sansRegular,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    color: Q.color.mute,
  },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  removeText: {
    fontSize: 14,
    color: Q.color.mute,
  },
});
