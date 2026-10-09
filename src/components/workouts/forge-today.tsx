import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, MoreHorizontal, Trophy } from "lucide-react-native";

import { CardioSheet } from "@/components/nutrition/more-sheets";
import {
  CalendarSheet,
  TodayMenuSheet,
} from "@/components/workouts/forge-sheets";
import { Button, FCard, Label, Pill, tap } from "@/components/workouts/forge-ui";
import { Font } from "@/constants/design";
import { F, FSerif } from "@/constants/forge-theme";
import type { ForgeData } from "@/hooks/use-forge";
import { useTodayKey } from "@/hooks/use-today-key";
import { buildCalendarSummaryMap } from "@/services/forge/calendar";
import { completedSessions, sessionDate } from "@/services/forge/history";
import { fromKg, sessionVolumeKg } from "@/services/forge/load";
import { dayFor, nextRotationDay } from "@/services/forge/plan";
import { activePlan } from "@/services/forge/settings";
import { durationMs } from "@/services/forge/timing";
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
  onGoPlan: () => void;
}) {
  const todayKey = useTodayKey();
  // null follows "today" (so it rolls over at midnight); a string is a past
  // day the user deliberately navigated to and stays put.
  const [picked, setPicked] = useState<string | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <View style={s.root}>
      {/* COMPACT DATE ROW */}
      <View style={s.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          hitSlop={8}
          style={s.stepBtn}
          onPress={() => stepDay(-1)}
        >
          <Text style={s.stepText}>‹</Text>
        </Pressable>

        <View style={s.dateCenter}>
          <Text style={s.dateTitle}>{isToday ? "Today" : dayLabel(dateKey)}</Text>
          {isToday ? (
            <Text style={s.dateSubtitle}>{dayLabel(dateKey)}</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to today"
              style={s.jumpChip}
              onPress={() => setPicked(null)}
            >
              <Text style={s.jumpChipText}>Back to today</Text>
            </Pressable>
          )}
        </View>

        <View style={s.dateActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            disabled={isToday}
            hitSlop={8}
            style={[s.stepBtn, isToday && s.stepBtnDisabled]}
            onPress={() => stepDay(1)}
          >
            <Text style={[s.stepText, isToday && s.stepTextDisabled]}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Workout calendar"
            hitSlop={8}
            style={s.iconBtn}
            onPress={() => setCalendarOpen(true)}
          >
            <Calendar size={18} color={F.mute} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Today options"
            hitSlop={8}
            style={s.iconBtn}
            onPress={() => setMenuOpen(true)}
          >
            <MoreHorizontal size={18} color={F.mute} />
          </Pressable>
        </View>
      </View>

      {!isToday ? (
        <Text style={s.meta}>
          {dayLabel(dateKey)}. Anything you start here is logged for this day.
        </Text>
      ) : null}

      {/* ACTIVE WORKOUT IN PROGRESS */}
      {active ? (
        <FCard style={s.card}>
          <Text style={s.meta}>{`Workout in progress · ${active.date ?? ""}`}</Text>
          <Text style={s.bigName}>{active.name}</Text>
          <Button label="Resume" onPress={() => onOpen(active)} />
        </FCard>
      ) : null}

      {/* COMPLETED WORKOUT RECAP HERO (NOT AN INVITATION) */}
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
            onPress={() => {
              tap();
              onOpen(session);
            }}
          >
            <FCard style={s.card}>
              <View style={s.recapHead}>
                <Text style={s.recapEyebrow}>
                  {session.backdated
                    ? "LOGGED WORKOUT"
                    : `DONE · ${formatDuration(durationMs(session, 0))}`}
                </Text>
              </View>

              <Text style={s.bigName}>{displayName(session.name)}</Text>

              <Text style={s.recapStats}>
                {`${formatDuration(durationMs(session, 0))} · ${formatWeight(
                  fromKg(sessionVolumeKg(session), unit),
                  unit,
                )} · ${plural(totalSets, "set")}`}
              </Text>

              {(session.prs ?? []).length > 0 ? (
                <View style={s.prBadgeRow}>
                  <Trophy size={14} color={F.acc} />
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
              <View style={s.tightList}>
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
            </FCard>
          </Pressable>
        );
      })}

      {/* CARDIO SECTION WITH UNDO REMOVAL */}
      {cardio.length > 0 ? (
        <FCard style={s.card}>
          <Label>Cardio</Label>
          {cardio.map((entry, index) => (
            <View key={entry.id} style={s.cardioRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={s.lineStrong}>{displayName(entry.name)}</Text>
                <Text style={s.meta}>
                  {entry.durationMin
                    ? `${entry.durationMin} min · ${entry.kcal} kcal`
                    : `${entry.kcal} kcal`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.name}`}
                hitSlop={8}
                style={s.cardioRemoveBtn}
                onPress={() => {
                  onRemoveCardio(dateKey, entry.id);
                  showUndoToast({
                    message: `Removed ${displayName(entry.name)}`,
                    onUndo: () => {
                      onRestoreCardio?.(dateKey, entry, index);
                    },
                  });
                }}
              >
                <Text style={s.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </FCard>
      ) : null}

      {/* NOT STARTED / REST DAY CARD */}
      {!active && done.length === 0 ? (
        <FCard style={s.card}>
          <Text style={s.meta}>
            {planned
              ? `${plan?.rotate ? "Next in rotation" : "Planned"}${
                  plan?.deload ? " · deload week" : ""
                }`
              : "No session planned"}
          </Text>
          <Text style={s.bigName}>
            {planned
              ? displayName(planned.name)
              : plan?.rotate && !isToday
                ? "Nothing logged"
                : "Rest day"}
          </Text>
          {planned ? (
            <>
              <Text style={s.meta}>
                {`${plural(planned.exercises.length, "exercise")} · ~${Math.max(
                  20,
                  planned.exercises.length * 10,
                )} min`}
              </Text>
              <View style={s.previewList}>
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
              <View style={s.buttonRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={`Start ${displayName(planned.name)}`}
                    onPress={() => start(planned.id)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Blank workout"
                    kind="secondary"
                    onPress={() => start(null)}
                  />
                </View>
              </View>
            </>
          ) : !plan || plan.days.length === 0 ? (
            <>
              <View style={s.gap}>
                <Button label="Build your plan" onPress={onGoPlan} />
              </View>
              <View style={s.pills}>
                <Pill label="Blank workout" onPress={() => start(null)} />
              </View>
            </>
          ) : (
            <>
              <View style={s.buttonRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Blank workout"
                    kind="secondary"
                    onPress={() => start(null)}
                  />
                </View>
              </View>
              <View style={s.pills}>
                {others.map((day) => (
                  <Pill
                    key={day.id}
                    label={displayName(day.name)}
                    onPress={() => start(day.id)}
                  />
                ))}
              </View>
            </>
          )}
          {planned && others.length > 0 ? (
            <View style={s.pills}>
              {others.map((day) => (
                <Pill
                  key={day.id}
                  label={displayName(day.name)}
                  onPress={() => start(day.id)}
                />
              ))}
            </View>
          ) : null}
          <Text style={[s.meta, { marginTop: 14 }]}>
            {`${plural(lastWeek, "workout")} in the last 7 days`}
          </Text>
        </FCard>
      ) : null}

      {/* MISSED DAYS PILLS */}
      {missed.length > 0 && !active ? (
        <View style={s.gap}>
          <Text style={s.meta}>Missed. Tap to log.</Text>
          <View style={s.pills}>
            {missed.slice(0, 3).map((entry) => (
              <Pill
                key={entry.key}
                label={`${entry.name} · ${dayLabel(entry.key).slice(0, 3)}`}
                onPress={() => start(entry.id, entry.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* SECONDARY CARDIO ACTION */}
      <View style={s.pills}>
        <Pill label="Log cardio" onPress={() => setCardioOpen(true)} />
      </View>

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

      {typeof TodayMenuSheet === "function" ? (
        <TodayMenuSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          hasFinishedWorkout={done.length > 0}
          onAddAnotherWorkout={() => start(null)}
          onOpenCalendar={() => setCalendarOpen(true)}
          onLogCardio={() => setCardioOpen(true)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepText: { color: F.ink, fontSize: 20, fontWeight: "500" },
  stepTextDisabled: { color: F.dim },
  dateCenter: { alignItems: "center", flex: 1, paddingHorizontal: 8 },
  dateTitle: {
    color: F.ink,
    fontFamily: FSerif,
    fontSize: 22,
    fontWeight: "300",
  },
  dateSubtitle: { color: F.mute, fontSize: 13, marginTop: 2 },
  jumpChip: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(217, 164, 65, 0.15)",
  },
  jumpChipText: { color: F.acc, fontSize: 12, fontWeight: "600" },
  dateActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { gap: 8 },
  recapHead: { flexDirection: "row", alignItems: "center" },
  recapEyebrow: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: F.acc,
  },
  meta: { color: F.mute, fontSize: 13 },
  bigName: {
    color: F.ink,
    fontFamily: FSerif,
    fontSize: 28,
    fontWeight: "300",
  },
  recapStats: {
    fontFamily: Font.sans,
    color: F.ink,
    fontSize: 15,
    fontWeight: "500",
  },
  prBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(217, 164, 65, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  prBadgeText: { color: F.acc, fontSize: 13, fontWeight: "600" },
  musclesText: { color: F.mute, fontSize: 13, fontStyle: "italic" },
  tightList: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: F.line,
  },
  upNextText: {
    color: F.dim,
    fontSize: 13,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: F.line,
    paddingTop: 8,
  },
  lineStrong: { color: F.ink, fontSize: 15, fontWeight: "500" },
  gap: { marginTop: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cardioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  cardioRemoveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: F.card2,
  },
  removeText: { color: F.mute, fontSize: 12, fontWeight: "500" },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 46,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: F.line,
    gap: 12,
  },
  exerciseName: { color: F.ink, fontSize: 15, fontWeight: "500", flex: 1 },
  exerciseSets: { color: F.mute, fontSize: 13, textAlign: "right" },
  previewList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: F.line,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
});
