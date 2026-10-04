import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CardioSheet } from "@/components/nutrition/more-sheets";
import { Button, FCard, Label, Pill, fmtInt, tap } from "@/components/workouts/forge-ui";
import { F, FSerif } from "@/constants/forge-theme";
import type { ForgeData } from "@/hooks/use-forge";
import { completedSessions, sessionDate } from "@/services/forge/history";
import { formatSets, fromKg, sessionVolumeKg } from "@/services/forge/load";
import { dayFor } from "@/services/forge/plan";
import { activePlan } from "@/services/forge/settings";
import { durationMs, formatClock } from "@/services/forge/timing";
import { MONTH_SHORT } from "@/services/nourish/insights";
import type { CardioLog } from "@/types/nourish";
import type { WorkoutSession } from "@/types/gymos";
import { addDaysToKey, dateFromKey, getTodayKey } from "@/utils/date";

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
  onGoPlan,
}: {
  data: ForgeData;
  unit: "kg" | "lb";
  weightKg: number;
  onStart: (input: { dayId: string | null; date: string; backdated: boolean }) => void;
  onOpen: (session: WorkoutSession) => void;
  onAddCardio: (dayKey: string, entry: Omit<CardioLog, "id" | "loggedAt">) => Promise<boolean>;
  onRemoveCardio: (dayKey: string, id: string) => void;
  onGoPlan: () => void;
}) {
  const todayKey = getTodayKey();
  const [dateKey, setDateKey] = useState(todayKey);
  const [cardioOpen, setCardioOpen] = useState(false);

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
    const age = (Date.now() - dateFromKey(sessionDate(session)).getTime()) / 864e5;

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

  const start = (dayId: string | null, date = dateKey) =>
    onStart({ dayId, date, backdated: date !== todayKey });

  return (
    <View style={s.root}>
      <View style={s.dateRow}>
        <Text style={s.date}>{isToday ? "Today" : dayLabel(dateKey)}</Text>
        <View style={s.nav}>
          <Pill label="‹" onPress={() => setDateKey(addDaysToKey(dateKey, -1))} />
          <Pill label="›" disabled={isToday} onPress={() => setDateKey(addDaysToKey(dateKey, 1))} />
        </View>
      </View>
      {!isToday ? <Text style={s.meta}>{dayLabel(dateKey)}. Anything you start here is logged for this day.</Text> : null}

      {active ? (
        <FCard style={s.card}>
          <Text style={s.meta}>{`Workout in progress · ${active.date ?? ""}`}</Text>
          <Text style={s.bigName}>{active.name}</Text>
          <Button label="Resume" onPress={() => onOpen(active)} />
        </FCard>
      ) : null}

      {done.map((session) => (
        <Pressable key={session.id} accessibilityRole="button" onPress={() => { tap(); onOpen(session); }}>
          <FCard style={s.card}>
            <Text style={s.meta}>
              {`Done · ${session.backdated ? "logged" : formatClock(durationMs(session, Date.now()))}`}
            </Text>
            <Text style={s.bigName}>{session.name}</Text>
            <Text style={s.meta}>
              {`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit} · ${session.exercises.length} exercises`}
            </Text>
            {session.exercises.slice(0, 4).map((exercise) => (
              <Text key={exercise.id} style={s.line} numberOfLines={1}>
                {`${exercise.name}  ${formatSets(exercise, unit)}`}
              </Text>
            ))}
            {(session.prs ?? []).length > 0 ? <Text style={s.pr}>{`${session.prs?.length} new record${session.prs?.length === 1 ? "" : "s"}`}</Text> : null}
          </FCard>
        </Pressable>
      ))}

      {cardio.length > 0 ? (
        <FCard style={s.card}>
          <Label>Cardio</Label>
          {cardio.map((entry) => (
            <View key={entry.id} style={s.cardioRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={s.lineStrong}>{entry.name}</Text>
                <Text style={s.meta}>{entry.detail}</Text>
              </View>
              <View style={s.cardioRight}>
                <Text style={s.lineStrong}>{`${entry.kcal} kcal`}</Text>
                <Pressable accessibilityRole="button" onPress={() => onRemoveCardio(dateKey, entry.id)}>
                  <Text style={s.remove}>remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </FCard>
      ) : null}

      {!active && done.length === 0 ? (
        <FCard style={s.card}>
          <Text style={s.meta}>
            {planned
              ? `${plan?.rotate ? "Next in rotation" : "Planned"}${plan?.deload ? " · deload week" : ""}`
              : "No session planned"}
          </Text>
          <Text style={s.bigName}>{planned ? planned.name : plan?.rotate && !isToday ? "Nothing logged" : "Rest day"}</Text>
          {planned ? (
            <>
              <Text style={s.meta}>{planned.exercises.map((exercise) => exercise.name).join(" · ")}</Text>
              <View style={s.gap}>
                <Button label={`Start ${planned.name}`} onPress={() => start(planned.id)} />
              </View>
            </>
          ) : !plan || plan.days.length === 0 ? (
            <View style={s.gap}>
              <Button label="Build your plan" onPress={onGoPlan} />
            </View>
          ) : null}
          <View style={s.pills}>
            {others.map((day) => (
              <Pill key={day.id} label={day.name} onPress={() => start(day.id)} />
            ))}
            <Pill label="Blank workout" onPress={() => start(null)} />
          </View>
          <Text style={[s.meta, { marginTop: 14 }]}>{`${lastWeek} workout${lastWeek === 1 ? "" : "s"} in the last 7 days`}</Text>
        </FCard>
      ) : !active ? (
        <View style={s.pills}>
          <Pill label="+ Add another workout" onPress={() => start(null)} />
        </View>
      ) : null}

      {missed.length > 0 && !active ? (
        <View style={s.gap}>
          <Text style={s.meta}>Missed. Tap to log.</Text>
          <View style={s.pills}>
            {missed.slice(0, 3).map((entry) => (
              <Pill key={entry.key} label={`${entry.name} · ${dayLabel(entry.key).slice(0, 3)}`} onPress={() => start(entry.id, entry.key)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={s.pills}>
        <Pill label="Log cardio" onPress={() => setCardioOpen(true)} />
      </View>

      <CardioSheet
        visible={cardioOpen}
        onClose={() => setCardioOpen(false)}
        initialText=""
        weightKg={weightKg}
        onSave={(entry) => onAddCardio(dateKey, entry)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: F.ink, fontFamily: FSerif, fontSize: 30, fontWeight: "300" },
  nav: { flexDirection: "row", gap: 6 },
  card: { gap: 6 },
  meta: { color: F.mute, fontSize: 13 },
  bigName: { color: F.ink, fontFamily: FSerif, fontSize: 28, fontWeight: "300" },
  line: { color: F.mute, fontSize: 13 },
  lineStrong: { color: F.ink, fontSize: 15 },
  pr: { color: F.acc, fontSize: 13, fontWeight: "600", marginTop: 4 },
  gap: { marginTop: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cardioRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 6 },
  cardioRight: { alignItems: "flex-end" },
  remove: { color: F.bad, fontSize: 12, marginTop: 2 },
});
