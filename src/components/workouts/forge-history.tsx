import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Bar, FCard, Label, fmtInt, tap } from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import type { ForgeData } from "@/hooks/use-forge";
import { muscleBalance } from "@/services/forge/balance";
import { historyGrid } from "@/services/forge/grid";
import { finishedSessions, sessionDate } from "@/services/forge/history";
import { fromKg, sessionVolumeKg, type WeightUnit } from "@/services/forge/load";
import { MONTH_SHORT } from "@/services/nourish/insights";
import type { WorkoutSession } from "@/types/gymos";
import { dateFromKey } from "@/utils/date";

export function HistoryView({
  data,
  unit,
  onOpen,
}: {
  data: ForgeData;
  unit: WeightUnit;
  onOpen: (session: WorkoutSession) => void;
}) {
  const balance = muscleBalance(data.sessions, data.catalog, 30, new Date());
  const hasBalance = balance.some((entry) => entry.sets > 0);
  const grid = historyGrid(data.sessions, unit, 8);
  const recent = [...finishedSessions(data.sessions)].reverse().slice(0, 20);

  if (recent.length === 0) {
    return (
      <FCard>
        <Text style={s.meta}>Finish a workout and your history, records and balance show up here.</Text>
      </FCard>
    );
  }

  return (
    <View style={s.root}>
      {hasBalance ? (
        <FCard style={s.gap}>
          <Label>Muscle balance · last 30 days</Label>
          {balance.map((entry) => (
            <View key={entry.group} style={s.balRow}>
              <Text style={s.balName}>{entry.group}</Text>
              <View style={{ flex: 1 }}>
                <Bar value={entry.share} max={1} color={F.acc} />
              </View>
              <Text style={s.balValue}>{`${entry.sets} sets`}</Text>
            </View>
          ))}
        </FCard>
      ) : null}

      {grid.rows.length > 0 ? (
        <FCard style={s.gap}>
          <Label>Best set by workout</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={s.gridRow}>
                <Text style={[s.gridHead, s.gridName]}>Exercise</Text>
                {grid.columns.map((column) => (
                  <Text key={column.session.id} style={[s.gridHead, s.gridCell]}>{column.label}</Text>
                ))}
              </View>
              {grid.rows.map((row) => (
                <View key={row.exerciseId} style={s.gridRow}>
                  <Text style={[s.gridText, s.gridName]} numberOfLines={1}>{row.name}</Text>
                  {row.cells.map((cell, index) => {
                    const column = grid.columns[index];
                    const pr = column?.session.prs?.some((entry) => entry.exerciseId === row.exerciseId);

                    return (
                      <Text key={column?.session.id ?? index} style={[s.gridText, s.gridCell, pr && s.gridPr]}>
                        {cell ?? "–"}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={s.meta}>Highlighted cells were records.</Text>
        </FCard>
      ) : null}

      <FCard style={s.gap}>
        <Label>Recent workouts</Label>
        {recent.map((session) => {
          const date = dateFromKey(sessionDate(session));

          return (
            <Pressable key={session.id} accessibilityRole="button" onPress={() => { tap(); onOpen(session); }} style={s.recent}>
              <View style={{ flexShrink: 1 }}>
                <Text style={s.recentName}>{session.name}</Text>
                <Text style={s.meta}>{`${date.getDate()} ${MONTH_SHORT[date.getMonth()]} · ${session.exercises.length} exercises`}</Text>
              </View>
              <Text style={s.recentVol}>{`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit}`}</Text>
            </Pressable>
          );
        })}
      </FCard>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  gap: { gap: 10 },
  meta: { color: F.mute, fontSize: 13 },
  balRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  balName: { color: F.ink, width: 72, fontSize: 14 },
  balValue: { color: F.mute, width: 60, textAlign: "right", fontSize: 12 },
  gridRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: F.line },
  gridHead: { color: F.mute, fontSize: 11, letterSpacing: 0.5 },
  gridName: { width: 128 },
  gridCell: { width: 84, textAlign: "center" },
  gridText: { color: F.ink, fontSize: 13 },
  gridPr: { color: F.acc, fontWeight: "700" },
  recent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: F.line },
  recentName: { color: F.ink, fontSize: 16 },
  recentVol: { color: F.mute, fontSize: 13 },
});
