import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trophy,
} from "lucide-react-native";

import { CalendarSheet } from "@/components/workouts/forge-sheets";
import { Bar, FCard, Label, Pill, Seg, tap } from "@/components/workouts/forge-ui";
import { Font } from "@/constants/design";
import { F, FSerif } from "@/constants/forge-theme";
import type { ForgeData } from "@/hooks/use-forge";
import { useTodayKey } from "@/hooks/use-today-key";
import { muscleBalance } from "@/services/forge/balance";
import { buildCalendarSummaryMap } from "@/services/forge/calendar";
import { historyGrid } from "@/services/forge/grid";
import { completedSessions, sessionDate } from "@/services/forge/history";
import { fromKg, round1, sessionVolumeKg, type WeightUnit } from "@/services/forge/load";
import { activePlan } from "@/services/forge/settings";
import { durationMs } from "@/services/forge/timing";
import { MONTH_SHORT } from "@/services/nourish/insights";
import type { WorkoutSession } from "@/types/gymos";
import { addDaysToKey, dateFromKey } from "@/utils/date";
import {
  displayName,
  formatDuration,
  formatNumber,
  formatWeight,
  plural,
} from "@/utils/format";
import { showUndoToast } from "@/utils/toast";

const VIEW_MODES: readonly { value: "list" | "grid"; label: string }[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
];

const RANGE_OPTIONS: readonly (7 | 30 | 90)[] = [7, 30, 90];

export function HistoryView({
  data,
  unit,
  onOpen,
  onDelete,
  onRestore,
}: {
  data: ForgeData;
  unit: WeightUnit;
  onOpen: (session: WorkoutSession) => void;
  onDelete?: (id: string) => Promise<boolean>;
  onRestore?: (session: WorkoutSession) => Promise<boolean>;
}) {
  const todayKey = useTodayKey();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const plan = activePlan(data.settings) ?? undefined;
  const completed = useMemo(
    () => completedSessions(data.sessions),
    [data.sessions],
  );
  const recent = useMemo(() => [...completed].reverse(), [completed]);

  const summaryMap = useMemo(
    () => buildCalendarSummaryMap(data.sessions, data.cardio),
    [data.sessions, data.cardio],
  );

  // 1. THIS WEEK SUMMARY HERO
  const thisWeekStats = useMemo(() => {
    const now = dateFromKey(todayKey);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonKey = addDaysToKey(todayKey, diffToMonday);
    const prevMonKey = addDaysToKey(thisMonKey, -7);
    const prevSunKey = addDaysToKey(thisMonKey, -1);
    const thisSunKey = addDaysToKey(thisMonKey, 6);

    const thisWeek = completed.filter((s) => {
      const d = sessionDate(s);
      return d >= thisMonKey && d <= thisSunKey;
    });
    const lastWeek = completed.filter((s) => {
      const d = sessionDate(s);
      return d >= prevMonKey && d <= prevSunKey;
    });

    const thisVol = thisWeek.reduce((sum, s) => sum + sessionVolumeKg(s), 0);
    const lastVol = lastWeek.reduce((sum, s) => sum + sessionVolumeKg(s), 0);
    const thisPrs = thisWeek.reduce((sum, s) => sum + (s.prs?.length ?? 0), 0);
    const thisDuration = thisWeek.reduce((sum, s) => sum + durationMs(s, 0), 0);

    const deltaSessions = thisWeek.length - lastWeek.length;
    const deltaVol = fromKg(thisVol - lastVol, unit);

    return {
      sessionsCount: thisWeek.length,
      lastSessionsCount: lastWeek.length,
      deltaSessions,
      volume: fromKg(thisVol, unit),
      deltaVol,
      prsCount: thisPrs,
      durationMs: thisDuration,
    };
  }, [completed, todayKey, unit]);

  // 2. MUSCLE BALANCE
  const balance = useMemo(
    () => muscleBalance(data.sessions, data.catalog, rangeDays, new Date()),
    [data.sessions, data.catalog, rangeDays],
  );
  const hasBalance = balance.some((entry) => entry.sets > 0);

  // 3. PR FEED (most recent 8 records)
  const prFeed = useMemo(() => {
    const list: {
      session: WorkoutSession;
      exerciseName: string;
      weight: number;
      reps: number;
      unit: WeightUnit;
      dateKey: string;
    }[] = [];

    for (const session of recent) {
      if (!session.prs || session.prs.length === 0) continue;
      for (const pr of session.prs) {
        const exName =
          session.exercises.find((e) => e.exerciseId === pr.exerciseId)?.name ??
          data.catalog.find((c) => c.id === pr.exerciseId)?.name ??
          pr.exerciseId;
        list.push({
          session,
          exerciseName: exName,
          weight: pr.weight,
          reps: pr.reps,
          unit: pr.unit ?? unit,
          dateKey: sessionDate(session),
        });
      }
    }
    return list.slice(0, 8);
  }, [recent, data.catalog, unit]);

  // 4. GROUPED WEEKS FOR WORKOUTS LIST
  const groupedWeeks = useMemo(() => {
    const map = new Map<
      string,
      { title: string; totalVol: number; sessions: WorkoutSession[] }
    >();

    for (const session of recent.slice(0, 30)) {
      const dKey = sessionDate(session);
      const d = dateFromKey(dKey);
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayKey = addDaysToKey(dKey, diffToMonday);
      const monDate = dateFromKey(mondayKey);
      const sunDate = dateFromKey(addDaysToKey(mondayKey, 6));

      const title = `Week of ${monDate.getDate()} ${MONTH_SHORT[monDate.getMonth()]} – ${sunDate.getDate()} ${MONTH_SHORT[sunDate.getMonth()]}`;

      if (!map.has(mondayKey)) {
        map.set(mondayKey, { title, totalVol: 0, sessions: [] });
      }
      const weekEntry = map.get(mondayKey)!;
      weekEntry.sessions.push(session);
      weekEntry.totalVol += fromKg(sessionVolumeKg(session), unit);
    }

    return Array.from(map.values());
  }, [recent, unit]);

  // 5. GRID DATA
  const grid = useMemo(() => historyGrid(data.sessions, unit, 10), [data.sessions, unit]);

  if (recent.length === 0) {
    return (
      <FCard>
        <Text style={s.meta}>
          Finish a workout and your history, records and balance show up here.
        </Text>
      </FCard>
    );
  }

  const handleDeleteWorkout = (session: WorkoutSession) => {
    if (!onDelete) return;
    void onDelete(session.id).then((ok) => {
      if (ok) {
        showUndoToast({
          message: `${displayName(session.name)} deleted`,
          onUndo: () => {
            if (onRestore) void onRestore(session);
          },
        });
      }
    });
  };

  return (
    <View style={s.root}>
      {/* HEADER CONTROLS: LIST / GRID SWITCH + CALENDAR BUTTON */}
      <View style={s.headerControls}>
        <View style={{ flex: 1 }}>
          <Seg
            options={VIEW_MODES}
            value={viewMode}
            onChange={(m) => setViewMode(m as "list" | "grid")}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open workout calendar"
          onPress={() => setCalendarOpen(true)}
          style={s.calBtn}
          hitSlop={8}
        >
          <Calendar size={18} color={F.mute} />
        </Pressable>
      </View>

      {viewMode === "grid" ? (
        /* FULL-WIDTH SPREADSHEET GRID VIEW */
        <FCard style={s.gap}>
          <Label>Best set by workout</Label>
          <View style={s.gridContainer}>
            {/* STICKY FIRST COLUMN: EXERCISES */}
            <View style={s.gridStickyCol}>
              <View style={[s.gridCellHead, s.gridStickyHead]}>
                <Text style={s.gridHeadText}>EXERCISE</Text>
              </View>
              {grid.rows.map((row) => (
                <View key={row.exerciseId} style={[s.gridCellRow, s.gridStickyCell]}>
                  <Text style={s.gridExerciseName} numberOfLines={2}>
                    {displayName(row.name)}
                  </Text>
                </View>
              ))}
            </View>

            {/* HORIZONTALLY SCROLLABLE SESSION COLUMNS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* DATE HEADERS */}
                <View style={s.gridRow}>
                  {grid.columns.map((col) => (
                    <Pressable
                      key={col.session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`View workout on ${col.label}`}
                      onPress={() => onOpen(col.session)}
                      style={[s.gridCellHead, s.gridColWidth]}
                    >
                      <Text style={s.gridHeadText}>{col.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* CELLS BY EXERCISE */}
                {grid.rows.map((row) => (
                  <View key={row.exerciseId} style={s.gridRow}>
                    {row.cells.map((cell, cIdx) => {
                      const col = grid.columns[cIdx];
                      const isPr = col?.session.prs?.some(
                        (pr) => pr.exerciseId === row.exerciseId,
                      );

                      return (
                        <Pressable
                          key={col?.session.id ?? cIdx}
                          accessibilityRole="button"
                          accessibilityLabel={
                            cell ? `${row.name}: ${cell}${isPr ? " (PR)" : ""}` : "No set"
                          }
                          disabled={!col || !cell}
                          onPress={() => {
                            if (col) onOpen(col.session);
                          }}
                          style={[
                            s.gridCellRow,
                            s.gridColWidth,
                            isPr && s.gridCellPr,
                          ]}
                        >
                          <Text
                            style={[
                              s.gridCellText,
                              isPr && s.gridCellTextPr,
                              !cell && s.gridCellEmpty,
                            ]}
                          >
                            {cell ?? "—"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          <Text style={s.meta}>
            Highlighted cells were records. Tap any cell to view session.
          </Text>
        </FCard>
      ) : (
        /* LIST VIEW */
        <>
          {/* 1. THIS WEEK SUMMARY HERO STRIP */}
          <FCard style={s.summaryCard}>
            <Text style={s.summaryEyebrow}>THIS WEEK</Text>
            <View style={s.summaryGrid}>
              <View style={s.summaryMetric}>
                <Text style={s.metricValue}>{thisWeekStats.sessionsCount}</Text>
                <Text style={s.metricLabel}>
                  {plural(thisWeekStats.sessionsCount, "workout")}
                </Text>
                {thisWeekStats.lastSessionsCount > 0 ? (
                  <Text style={s.metricDelta}>
                    {thisWeekStats.deltaSessions >= 0
                      ? `+${thisWeekStats.deltaSessions} vs last wk`
                      : `${thisWeekStats.deltaSessions} vs last wk`}
                  </Text>
                ) : null}
              </View>

              <View style={s.summaryMetric}>
                <Text style={s.metricValue}>
                  {formatNumber(Math.round(thisWeekStats.volume))}
                </Text>
                <Text style={s.metricLabel}>{unit}</Text>
                {thisWeekStats.deltaVol !== 0 ? (
                  <Text style={s.metricDelta}>
                    {thisWeekStats.deltaVol >= 0
                      ? `+${Math.round(thisWeekStats.deltaVol)} ${unit}`
                      : `${Math.round(thisWeekStats.deltaVol)} ${unit}`}
                  </Text>
                ) : null}
              </View>

              <View style={s.summaryMetric}>
                <Text style={s.metricValue}>{thisWeekStats.prsCount}</Text>
                <Text style={s.metricLabel}>{plural(thisWeekStats.prsCount, "PR")}</Text>
              </View>

              <View style={s.summaryMetric}>
                <Text style={s.metricValue}>
                  {thisWeekStats.durationMs > 0
                    ? formatDuration(thisWeekStats.durationMs)
                    : "0m"}
                </Text>
                <Text style={s.metricLabel}>Active</Text>
              </View>
            </View>
          </FCard>

          {/* 2. MUSCLE BALANCE WITH RANGE CHIPS AND DRILL-DOWN */}
          {hasBalance ? (
            <FCard style={s.gap}>
              <View style={s.balanceHeader}>
                <Label>Muscle balance</Label>
                <View style={s.rangeChips}>
                  {RANGE_OPTIONS.map((days) => (
                    <Pill
                      key={days}
                      label={`${days}d`}
                      active={rangeDays === days}
                      onPress={() => setRangeDays(days)}
                    />
                  ))}
                </View>
              </View>

              {balance.map((entry) => {
                const isExpanded = expandedGroup === entry.group;
                const specificMuscles = Object.entries(entry.muscles).filter(
                  ([, count]) => count > 0,
                );

                return (
                  <View key={entry.group} style={s.balanceGroupItem}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.group}: ${entry.sets} sets. Tap to toggle breakdown`}
                      onPress={() => {
                        tap();
                        setExpandedGroup(isExpanded ? null : entry.group);
                      }}
                      style={s.balRow}
                    >
                      <View style={s.balNameRow}>
                        <Text style={s.balName}>{entry.group}</Text>
                        {specificMuscles.length > 0 ? (
                          isExpanded ? (
                            <ChevronUp size={14} color={F.mute} />
                          ) : (
                            <ChevronDown size={14} color={F.dim} />
                          )
                        ) : null}
                      </View>
                      <View style={s.barTrack}>
                        <Bar value={entry.share} max={1} color={F.acc} />
                      </View>
                      <Text style={s.balValue}>{plural(entry.sets, "set")}</Text>
                    </Pressable>

                    {/* DRILL-DOWN BREAKDOWN BY INDIVIDUAL MUSCLE */}
                    {isExpanded && specificMuscles.length > 0 ? (
                      <View style={s.drillDownContainer}>
                        {specificMuscles.map(([mName, mSets]) => (
                          <View key={mName} style={s.drillDownRow}>
                            <Text style={s.drillDownName}>
                              {displayName(mName)}
                            </Text>
                            <Text style={s.drillDownValue}>
                              {plural(mSets, "set")}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </FCard>
          ) : null}

          {/* 3. PR FEED */}
          {prFeed.length > 0 ? (
            <FCard style={s.gap}>
              <View style={s.prHeaderRow}>
                <Trophy size={16} color={F.acc} />
                <Label>Personal records</Label>
              </View>
              {prFeed.map((item, idx) => {
                const d = dateFromKey(item.dateKey);
                return (
                  <Pressable
                    key={`${item.session.id}-${item.exerciseName}-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={`PR: ${item.exerciseName} ${round1(item.weight)} ${item.unit} for ${item.reps} reps`}
                    onPress={() => {
                      tap();
                      onOpen(item.session);
                    }}
                    style={s.prItemRow}
                  >
                    <View style={s.prLeft}>
                      <Text style={s.prExerciseName} numberOfLines={1}>
                        {displayName(item.exerciseName)}
                      </Text>
                      <Text style={s.prDate}>
                        {`${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`}
                      </Text>
                    </View>
                    <Text style={s.prScore}>
                      {`${round1(item.weight)} ${item.unit} × ${item.reps}`}
                    </Text>
                  </Pressable>
                );
              })}
            </FCard>
          ) : null}

          {/* 4. WORKOUTS LIST GROUPED BY WEEK */}
          <FCard style={s.gap}>
            <Label>Workouts</Label>
            {groupedWeeks.map((week) => (
              <View key={week.title} style={s.weekGroup}>
                <View style={s.weekHeaderRow}>
                  <Text style={s.weekHeader}>{week.title}</Text>
                  <Text style={s.weekTotals}>
                    {`${plural(week.sessions.length, "workout")} · ${formatWeight(
                      Math.round(week.totalVol),
                      unit,
                    )}`}
                  </Text>
                </View>

                {week.sessions.map((session) => {
                  const date = dateFromKey(sessionDate(session));
                  const dur = session.backdated
                    ? "logged"
                    : formatDuration(durationMs(session, 0));
                  const totalSets = session.exercises.reduce(
                    (sum, e) => sum + e.sets.filter((st) => st.completed).length,
                    0,
                  );

                  return (
                    <View key={session.id} style={s.workoutRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View workout ${session.name}`}
                        onPress={() => {
                          tap();
                          onOpen(session);
                        }}
                        style={s.rowLeft}
                      >
                        <Text style={s.workoutName} numberOfLines={1}>
                          {displayName(session.name)}
                        </Text>
                        <Text style={s.meta}>
                          {`${date.getDate()} ${MONTH_SHORT[date.getMonth()]} · ${plural(
                            session.exercises.length,
                            "exercise",
                          )} · ${plural(totalSets, "set")} · ${dur}`}
                        </Text>
                      </Pressable>

                      <View style={s.rowRight}>
                        <Text style={s.workoutVol}>
                          {formatWeight(
                            fromKg(sessionVolumeKg(session), unit),
                            unit,
                          )}
                        </Text>
                        {onDelete ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${session.name}`}
                            hitSlop={8}
                            onPress={() => handleDeleteWorkout(session)}
                            style={s.rowOverflowBtn}
                          >
                            <MoreHorizontal size={18} color={F.mute} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </FCard>
        </>
      )}

      {/* CALENDAR SHEET */}
      {typeof CalendarSheet === "function" ? (
        <CalendarSheet
          visible={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          summaryMap={summaryMap}
          todayKey={todayKey}
          selectedKey={todayKey}
          plan={plan}
          sessions={data.sessions}
          onSelectDate={(key) => {
            setCalendarOpen(false);
            const matched = data.sessions.find((s) => sessionDate(s) === key);
            if (matched) onOpen(matched);
          }}
          onStartPastWorkout={() => {
            setCalendarOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  gap: { gap: 10 },
  meta: { color: F.mute, fontSize: 13 },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  calBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: { gap: 10 },
  summaryEyebrow: {
    fontFamily: Font.sans,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: F.acc,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryMetric: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontFamily: FSerif,
    fontSize: 22,
    fontWeight: "300",
    color: F.ink,
    fontVariant: ["tabular-nums"],
  },
  metricLabel: {
    fontFamily: Font.sans,
    fontSize: 12,
    color: F.mute,
    marginTop: 2,
  },
  metricDelta: {
    fontFamily: Font.sans,
    fontSize: 10,
    color: F.acc,
    marginTop: 2,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rangeChips: {
    flexDirection: "row",
    gap: 6,
  },
  balanceGroupItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: F.line,
    paddingVertical: 4,
  },
  balRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  balNameRow: {
    width: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balName: {
    color: F.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "center",
  },
  balValue: {
    color: F.mute,
    width: 54,
    textAlign: "right",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  drillDownContainer: {
    paddingLeft: 16,
    paddingBottom: 8,
    gap: 4,
  },
  drillDownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  drillDownName: {
    color: F.dim,
    fontSize: 13,
  },
  drillDownValue: {
    color: F.mute,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  prHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: F.line,
  },
  prLeft: { flex: 1, gap: 2 },
  prExerciseName: { color: F.ink, fontSize: 14, fontWeight: "500" },
  prDate: { color: F.mute, fontSize: 12 },
  prScore: {
    fontFamily: Font.sans,
    color: F.acc,
    fontWeight: "600",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  weekGroup: { marginTop: 6 },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 10,
    marginBottom: 4,
  },
  weekHeader: {
    color: F.ink,
    fontFamily: FSerif,
    fontSize: 16,
    fontWeight: "300",
  },
  weekTotals: {
    color: F.mute,
    fontSize: 12,
  },
  workoutRow: {
    minHeight: 72,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: F.line,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  workoutName: { color: F.ink, fontSize: 16, fontWeight: "500" },
  workoutVol: { color: F.mute, fontSize: 13, textAlign: "right", fontVariant: ["tabular-nums"] },
  rowOverflowBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  gridContainer: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: F.line,
    overflow: "hidden",
    marginVertical: 4,
  },
  gridStickyCol: {
    width: 128,
    borderRightWidth: 1,
    borderRightColor: F.line,
    backgroundColor: F.card2,
  },
  gridStickyHead: {
    backgroundColor: F.card2,
  },
  gridStickyCell: {
    backgroundColor: F.card2,
  },
  gridExerciseName: {
    fontFamily: Font.sans,
    fontSize: 12,
    fontWeight: "500",
    color: F.ink,
  },
  gridRow: {
    flexDirection: "row",
  },
  gridCellHead: {
    height: 36,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: F.line,
  },
  gridHeadText: {
    fontFamily: Font.sans,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: "600",
    color: F.mute,
  },
  gridColWidth: {
    width: 90,
  },
  gridCellRow: {
    height: 48,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: F.line,
  },
  gridCellText: {
    fontFamily: Font.sans,
    fontSize: 12,
    color: F.ink,
    fontVariant: ["tabular-nums"],
  },
  gridCellEmpty: {
    color: F.dim,
  },
  gridCellPr: {
    backgroundColor: "rgba(217, 164, 65, 0.18)",
    borderWidth: 1,
    borderColor: F.acc,
  },
  gridCellTextPr: {
    color: F.acc,
    fontWeight: "700",
  },
});
