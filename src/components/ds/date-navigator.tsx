import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Font } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { dateFromKey } from "@/utils/date";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function dayLabel(key: string): string {
  const date = dateFromKey(key);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export type DateNavigatorProps = {
  dateKey: string;
  todayKey: string;
  onStep: (delta: number) => void;
  onOpenCalendar?: () => void;
  onBackToToday?: () => void;
  accentColor?: string;
  extraAction?: React.ReactNode;
};

export function DateNavigator({
  dateKey,
  todayKey,
  onStep,
  onOpenCalendar,
  onBackToToday,
  accentColor,
  extraAction,
}: DateNavigatorProps) {
  const theme = useTheme();
  const acc = accentColor ?? theme.acc;
  const isToday = dateKey === todayKey;

  return (
    <View style={styles.dateRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        hitSlop={8}
        style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.line }]}
        onPress={() => onStep(-1)}
      >
        <ChevronLeft size={20} color={theme.ink} />
      </Pressable>

      <View style={styles.dateCenter}>
        <Text style={[styles.dateTitle, { color: theme.ink }]}>
          {isToday ? "Today" : dayLabel(dateKey)}
        </Text>
        {isToday ? (
          <Text style={[styles.dateSubtitle, { color: theme.mute }]}>
            {dayLabel(dateKey)}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            style={[styles.jumpChip, { backgroundColor: `${acc}26` }]}
            onPress={onBackToToday}
          >
            <Text style={[styles.jumpChipText, { color: acc }]}>
              Back to today
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.dateActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={isToday}
          hitSlop={8}
          style={[
            styles.stepBtn,
            { backgroundColor: theme.card, borderColor: theme.line },
            isToday && styles.stepBtnDisabled,
          ]}
          onPress={() => onStep(1)}
        >
          <ChevronRight size={20} color={isToday ? theme.dim : theme.ink} />
        </Pressable>

        {onOpenCalendar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.line }]}
            onPress={onOpenCalendar}
          >
            <Calendar size={18} color={theme.mute} />
          </Pressable>
        ) : null}

        {extraAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  dateCenter: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  dateTitle: {
    fontFamily: Font.serif,
    fontSize: 22,
    fontWeight: "300",
  },
  dateSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  jumpChip: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  jumpChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
