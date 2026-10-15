import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Q } from "@/constants/quiet";
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
  const isToday = dateKey === todayKey;
  const dateObj = dateFromKey(dateKey);
  const formattedDay = dayLabel(dateKey);
  const accessibilityLabel = isToday
    ? `Today, ${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`
    : formattedDay;

  return (
    <View style={styles.dateRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        hitSlop={8}
        style={styles.stepBtn}
        onPress={() => onStep(-1)}
      >
        <ChevronLeft size={20} strokeWidth={1.5} color={Q.color.mute} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onOpenCalendar}
        style={styles.dateCenter}
      >
        <Text style={styles.dateTitle}>
          {isToday ? (
            <>
              <Text>Today</Text>
              <Text>{`, ${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`}</Text>
            </>
          ) : (
            <Text>{formattedDay}</Text>
          )}
        </Text>
      </Pressable>

      <View style={styles.dateActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={isToday}
          hitSlop={8}
          style={[styles.stepBtn, isToday && styles.stepBtnDisabled]}
          onPress={() => onStep(1)}
        >
          <ChevronRight size={20} strokeWidth={1.5} color={Q.color.mute} />
        </Pressable>

        {onOpenCalendar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            hitSlop={8}
            style={styles.stepBtn}
            onPress={onOpenCalendar}
          >
            <Calendar size={18} strokeWidth={1.5} color={Q.color.mute} />
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
    minHeight: 44,
    marginBottom: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  dateCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    minHeight: 44,
  },
  dateTitle: {
    fontFamily: Q.font.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    color: Q.color.ink,
  },
  dateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
