import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Trophy } from "lucide-react-native";

import { CardioSheet } from "@/components/nutrition/more-sheets";
import { CardioSection, DateNavigator, WeekStrip } from "@/components/ds";
import {
  CalendarSheet,
  StaleSessionSheet,
} from "@/components/workouts/forge-sheets";
import { Button } from "@/components/workouts/forge-ui";
import { Q } from "@/constants/quiet";
import type { ForgeData } from "@/hooks/use-forge";
import { useTodayKey } from "@/hooks/use-today-key";
import { buildCalendarSummaryMap } from "@/services/forge/calendar";
import { completedSessions, sessionDate } from "@/services/forge/history";
import { fromKg, sessionVolumeKg } from "@/services/forge/load";
import { dayFor, nextRotationDay } from "@/services/forge/plan";
import { activePlan } from "@/services/forge/settings";
import { durationMs, finish } from "@/services/forge/timing";
import { MONTH_SHORT } from "@/services/nourish/insights";
import type { CardioLog } from "@/types/nourish";
import type { WorkoutSession } from "@/types/gymos";
import { addDaysToKey, dateFromKey, getTodayKey } from "@/utils/date";
import {
  displayName,
  formatDuration,
  formatPlanTarget,
  formatSetGroup,
  formatWeight,
  plural,
} from "@/utils/format";
import { showUndoToast } from "@/utils/toast";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayLabel = (key: string) => {
  const date = dateFromKey(key);

  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
};

export function TodayView({
  data,
  unit,
  weightKg,
  onStart,
  onOpen,
  onAddCardio,
  onRemoveCardio,
  onRestoreCardio,
  onSaveSession,
  onDiscardSession,
  onGoPlan,
}: {
  data: ForgeData;
  unit: "kg" | "lb";
  weightKg: number;
  onStart: (input: { dayId: string | null; date: string; backdated: boolean }) => void;
  onOpen: (session: WorkoutSession) => void;
  onAddCardio: (dayKey: string, entry: Omit<CardioLog, "id" | "loggedAt">) => Promise<boolean>;
  onRemoveCardio: (dayKey: string, id: string) => void;
  onRestoreCardio?: (dayKey: string, log: CardioLog, index?: number) => void;
  onSaveSession?: (session: WorkoutSession) => Promise<boolean>;
  onDiscardSession?: (id: string) => Promise<boolean>;
  onGoPlan: () => void;
}) {
  const todayKey = useTodayKey();
  const [picked, setPicked] = useState<string | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [staleSheetOpen, setStaleSheetOpen] = useState(false);

  const dateKey = picked ?? todayKey;
  const isToday = dateKey === todayKey;
  const plan = activePlan(data.settings) ?? undefined;
  const planned = dayFor(plan, dateKey, todayKey, data.sessions);
  const active = data.sessions.find((session) => !session.endedAt);
  const done = completedSessions(data.sessions).filter(
    (session) => sessionDate(session) === dateKey,
  );
  const cardio = data.cardio[dateKey] ?? [];
  const others = (plan?.days ?? []).filter((day) => day.id !== planned?.id);
  const lastWeek = completedSessions(data.sessions).filter((session) => {
    const age =
      (dateFromKey(todayKey).getTime() - dateFromKey(sessionDate(session)).getTime()) /
      864e5;

    return age < 7;
  }).length;

  const missed: { key: string; id: string; name: string }[] = [];

  if (isToday && plan && !plan.rotate) {
    for (let back = 1; back <= 6; back += 1) {
      const key = addDaysToKey(todayKey, -back);
      const day = dayFor(plan, key, todayKey, data.sessions);

      if (day && !data.sessions.some((session) => sessionDate(session) === key)) {
        missed.push({ key, id: day.id, name: day.name });
      }
    }
  }

  // Pre-index session and cardio data once for calendar lookups
  const summaryMap = useMemo(
    () => buildCalendarSummaryMap(data.sessions, data.cardio),
    [data.sessions, data.cardio],
  );

  const resolveDate = (explicit?: string) => {
    const now = getTodayKey();
    const wanted = explicit ?? picked ?? now;

    return wanted < now ? wanted : now;
  };

  const start = (dayId: string | null, date?: string) => {
    const now = getTodayKey();
    const resolved = resolveDate(date);

    onStart({ dayId, date: resolved, backdated: resolved !== now });
  };

  const stepDay = (delta: number) => {
    const next = addDaysToKey(dateKey, delta);

    setPicked(next < todayKey ? next : null);
  };

  const nextDay = plan ? nextRotationDay(plan, data.sessions) : null;

  // WeekStrip day indices (Monday = 0, Sunday = 6)
  const jsDay = dateFromKey(dateKey).getDay();
  const dayIndex = (jsDay + 6) % 7;
  const mondayKey = addDaysToKey(dateKey, -dayIndex);
  const completedDayIndices: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const k = addDaysToKey(mondayKey, i);
    if (data.sessions.some((s) => sessionDate(s) === k && s.endedAt)) {
      completedDayIndices.push(i);
    }
  }

  const workoutHeadline = planned
    ? displayName(planned.name)
    : plan?.rotate && !isToday
      ? "Nothing logged"
      : !plan || plan.days.length === 0
        ? "No plan"
        : "Rest day";

  const workoutSentence = planned
    ? `${plural(planned.exercises.length, "exercise")}, about ${Math.max(
        20,
        planned.exercises.length * 10,
      )} minutes. ${plural(lastWeek, "workout")} in the last 7 days.`
    : `${plural(lastWeek, "workout")} in the last 7 days.`;

  return (
    <View style={s.root}>
      {/* 3.4 COMPACT DATE ROW */}
      <DateNavigator
        dateKey={dateKey}
        todayKey={todayKey}
        onStep={stepDay}
        onOpenCalendar={() => setCalendarOpen(true)}
        onBackToToday={() => setPicked(null)}
        accentColor={Q.accent.ember}
      />

      {!isToday ? (
        <Text style={s.meta}>
          {dayLabel(dateKey)}. Anything you start here is logged for this day.
        </Text>
      ) : null}

      {/* ACTIVE WORKOUT IN PROGRESS */}
      {active ? (
        <View style={s.sectionBlock}>
          <Text style={s.meta}>{`Workout in progress · ${active.date ?? ""}`}</Text>
          <Text style={s.homeGoal}>{displayName(active.name)}</Text>
          <View style={{ marginTop: 18 }}>
            <Button
              label="Resume workout"
              onPress={() => {
                const activeDay = sessionDate(active);
                if (activeDay < todayKey) {
                  setStaleSheetOpen(true);
                } else {
                  onOpen(active);
                }
              }}
            />
          </View>
        </View>
      ) : null}

      {/* COMPLETED WORKOUT RECAP (FLAT HAIRLINES) */}
      {done.map((session) => {
        const totalSets = session.exercises.reduce(
          (sum, e) => sum + e.sets.filter((st) => st.completed).length,
          0,
        );

        const musclesHit = Array.from(
          new Set(
            session.exercises
              .map((e) => data.catalog.find((c) => c.id === e.exerciseId)?.muscleGroup)
              .filter(Boolean),
          ),
        );

        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            onPress={() => onOpen(session)}
            style={s.sectionBlock}
          >
            <Text style={s.meta}>
              {session.backdated
                ? "Logged workout"
                : `Done · ${formatDuration(durationMs(session, 0))}`}
            </Text>

            <Text style={s.homeGoal}>{displayName(session.name)}</Text>

            <Text style={s.sentence}>
              {`${formatDuration(durationMs(session, 0))} · ${formatWeight(
                fromKg(sessionVolumeKg(session), unit),
                unit,
              )} · ${plural(totalSets, "set")}`}
            </Text>

            {(session.prs ?? []).length > 0 ? (
              <View style={s.prBadgeRow}>
                <Trophy size={14} color={Q.accent.ember} />
                <Text style={s.prBadgeText}>
                  {plural(session.prs?.length ?? 0, "new record")}
                </Text>
              </View>
            ) : null}

            {musclesHit.length > 0 ? (
              <Text style={s.musclesText}>
                {`Muscles hit: ${musclesHit.join(" · ")}`}
              </Text>
            ) : null}

            {/* Tight exercise list */}
            <View style={s.hairlineList}>
              {session.exercises.map((exercise) => (
                <View key={exercise.id} style={s.exerciseRow}>
                  <Text style={s.exerciseName} numberOfLines={1}>
                    {displayName(exercise.name)}
                  </Text>
                  <Text style={s.exerciseSets}>
                    {formatSetGroup(exercise.sets, unit, exercise.bodyweight)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Up next guidance */}
            <Text style={s.upNextText}>
              {`Up next: ${nextDay ? displayName(nextDay.name) : "Rest day"} · tomorrow`}
            </Text>
          </Pressable>
        );
      })}

      {/* 4.1 TODAY NOT STARTED (HERO + WEEKSTRIP + HAIRLINE LIST + PRIMARY BTN) */}
      {!active && done.length === 0 ? (
        <View style={s.sectionBlock}>
          <Text style={s.homeGoal}>{workoutHeadline}</Text>
          <Text style={s.sentence}>{workoutSentence}</Text>

          <WeekStrip
            todayIndex={dayIndex}
            completedDays={completedDayIndices}
            accentColor={Q.accent.ember}
            style={s.weekStrip}
          />

          {planned ? (
            <>
              <View style={s.hairlineList}>
                {planned.exercises.map((exercise) => (
                  <View key={exercise.exerciseId} style={s.exerciseRow}>
                    <Text style={s.exerciseName} numberOfLines={1}>
                      {displayName(exercise.name)}
                    </Text>
                    <Text style={s.exerciseSets}>
                      {formatPlanTarget(exercise, unit)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 24 }}>
                <Button
                  label={`Start ${displayName(planned.name)}`}
                  onPress={() => start(planned.id)}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Blank workout"
                hitSlop={10}
                style={s.textLinkBtn}
                onPress={() => start(null)}
              >
                <Text style={s.textLinkText}>Blank workout</Text>
              </Pressable>

              {others.length > 0 ? (
                <View style={s.otherDaysRow}>
                  <Text style={s.meta}>Other days: </Text>
                  {others.map((day) => (
                    <Pressable
                      key={day.id}
                      accessibilityRole="button"
                      onPress={() => start(day.id)}
                      hitSlop={8}
                    >
                      <Text style={s.otherDayLink}>{displayName(day.name)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : !plan || plan.days.length === 0 ? (
            <View style={{ marginTop: 20 }}>
              <Button label="Build your plan" onPress={onGoPlan} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Blank workout"
                hitSlop={10}
                style={s.textLinkBtn}
                onPress={() => start(null)}
              >
                <Text style={s.textLinkText}>Blank workout</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 20 }}>
              <Button
                label="Start workout"
                onPress={() => start(others[0]?.id ?? null)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Blank workout"
                hitSlop={10}
                style={s.textLinkBtn}
                onPress={() => start(null)}
              >
                <Text style={s.textLinkText}>Blank workout</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {/* 4.1 MISSED DAYS SENTENCE WITH ACCENT TEXT LINKS */}
      {missed.length > 0 && !active ? (
        <View style={s.missedSection}>
          <Text style={s.meta}>Missed. Tap to log:</Text>
          <View style={s.missedLinks}>
            {missed.slice(0, 3).map((entry) => (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => start(entry.id, entry.key)}
                style={s.missedLinkBtn}
              >
                <Text style={s.textLinkText}>
                  {`${entry.name} · ${dayLabel(entry.key).slice(0, 3)}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 4.1 CARDIO SECTION (FLAT HAIRLINES WITH ACCENT LINK) */}
      <CardioSection
        entries={cardio}
        onAddPress={() => setCardioOpen(true)}
        accentColor={Q.accent.ember}
        onRemovePress={(entry, index) => {
          const originalLog = cardio.find((c) => c.id === entry.id);
          onRemoveCardio(dateKey, entry.id);
          showUndoToast({
            message: `Removed ${displayName(entry.name)}`,
            onUndo: () => {
              if (originalLog) onRestoreCardio?.(dateKey, originalLog, index);
            },
          });
        }}
      />

      {/* SHEETS */}
      <CardioSheet
        visible={cardioOpen}
        onClose={() => setCardioOpen(false)}
        initialText=""
        weightKg={weightKg}
        onSave={(entry) => onAddCardio(resolveDate(), entry)}
      />

      {typeof CalendarSheet === "function" ? (
        <CalendarSheet
          visible={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          summaryMap={summaryMap}
          todayKey={todayKey}
          selectedKey={dateKey}
          plan={plan}
          sessions={data.sessions}
          onSelectDate={(key) => {
            setPicked(key === todayKey ? null : key);
          }}
          onStartPastWorkout={(key) => {
            start(null, key);
          }}
        />
      ) : null}

      {active ? (
        <StaleSessionSheet
          visible={staleSheetOpen}
          onClose={() => setStaleSheetOpen(false)}
          sessionName={active.name}
          startDate={active.date ?? sessionDate(active)}
          onFinishAsItWas={() => {
            setStaleSheetOpen(false);
            const finished = finish(active, new Date());
            if (onSaveSession) {
              void onSaveSession(finished.session);
            }
          }}
          onDiscard={() => {
            setStaleSheetOpen(false);
            if (onDiscardSession) {
              void onDiscardSession(active.id);
            }
          }}
          onResumeToday={() => {
            setStaleSheetOpen(false);
            onOpen(active);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    gap: 18,
  },
  sectionBlock: {
    marginTop: 8,
  },
  homeGoal: {
    fontFamily: Q.font.displayMedium,
    fontSize: 50,
    lineHeight: 51,
    letterSpacing: -1.5,
    fontWeight: "500",
    color: Q.color.ink,
  },
  sentence: {
    fontFamily: Q.font.sansRegular,
    fontSize: 16,
    lineHeight: 22,
    color: Q.color.mute,
    marginTop: 10,
  },
  weekStrip: {
    marginVertical: 18,
  },
  meta: {
    fontFamily: Q.font.sansRegular,
    color: Q.color.mute,
    fontSize: 13,
  },
  hairlineList: {
    marginTop: 12,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 46,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    gap: 12,
  },
  exerciseName: {
    color: Q.color.ink,
    fontFamily: Q.font.sansMedium,
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  exerciseSets: {
    color: Q.color.mute,
    fontFamily: Q.font.sansRegular,
    fontSize: 14,
    textAlign: "right",
  },
  textLinkBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  textLinkText: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 13,
    fontWeight: "600",
    color: Q.accent.ember,
  },
  otherDaysRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  otherDayLink: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 13,
    color: Q.color.mute,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  missedSection: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  missedLinks: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  missedLinkBtn: {
    minHeight: 44,
    justifyContent: "center",
  },
  prBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  prBadgeText: {
    color: Q.accent.ember,
    fontFamily: Q.font.sansSemiBold,
    fontSize: 13,
    fontWeight: "600",
  },
  musclesText: {
    color: Q.color.mute,
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    marginTop: 4,
  },
  upNextText: {
    color: Q.color.mute,
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
    paddingTop: 12,
  },
});
