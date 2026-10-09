import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BarChart, LineChart } from "@/components/nutrition/nourish-charts";
import { ChangeLogSheet, WeeklyReadSheet } from "@/components/nutrition/more-sheets";
import {
  Bar,
  Button,
  Field,
  Label,
  NCard,
  Seg,
  fmtInt,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NSerif } from "@/constants/nourish-theme";
import type { useNourish } from "@/hooks/use-nourish";
import { useTodayKey } from "@/hooks/use-today-key";
import {
  availableRanges,
  averageOf,
  bucketSeries,
  daysOnTarget,
  loggedSpanDays,
  mealByMeal,
  rangeDayCount,
  RANGES,
  recentDays,
  type RangeId,
  type SeriesKey,
} from "@/services/nourish/insights";
import { dayTitle, FEEL_OPTIONS } from "@/services/nourish/format";
import { macroTargets } from "@/services/nourish/nutrition";
import {
  formatWeight,
  fromKg,
  suggestCalorieAdjustment,
  toKg,
  weeklySlope,
  weightChange,
} from "@/services/nourish/weight";
import { buildWeeklyRead } from "@/services/nourish/weekly-read";
import type { NourishSettings } from "@/types/nourish";
import { showToast, showUndoToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;

const SERIES: readonly { value: SeriesKey; label: string; color: string }[] = [
  { value: "protein", label: "Protein", color: N.protein },
  { value: "carbs", label: "Carbs", color: N.carbs },
  { value: "fat", label: "Fat", color: N.fat },
  { value: "calories", label: "Calories", color: N.acc },
];

export function InsightsView({
  nourish,
  onChangeSettings,
}: {
  nourish: Nourish;
  onChangeSettings: (patch: Partial<NourishSettings>, description: string) => void;
}) {
  const { data, records, actions, weightUnit } = nourish;
  const todayKey = useTodayKey();
  const [rangeId, setRangeId] = useState<RangeId>("7");
  const [seriesKey, setSeriesKey] = useState<SeriesKey>("protein");
  const [weightText, setWeightText] = useState("");
  const [readOpen, setReadOpen] = useState(false);
  const [changeLogOpen, setChangeLogOpen] = useState(false);

  const span = records ? loggedSpanDays(records, todayKey) : 0;
  const ranges = availableRanges(span);
  // If the chosen range stops being available, fall back to the shortest.
  const range = ranges.find((r) => r.id === rangeId) ?? RANGES[0]!;

  const days =
    records && data
      ? recentDays(rangeDayCount(range, span), todayKey, records, data.settings)
      : [];
  const logged = days.filter((day) => day.totals);
  const series = bucketSeries(days, seriesKey);
  const { rows, weakest } = mealByMeal(logged);

  const read =
    records && data
      ? buildWeeklyRead({
          days: recentDays(14, todayKey, records, data.settings),
          settings: data.settings,
          weightSlope: weeklySlope(data.weights.slice(-14)),
        })
      : null;

  if (!data) return <Text style={s.mute}>Loading…</Text>;

  const settings = data.settings;
  const targets = macroTargets(settings.kcal, settings);
  const target =
    seriesKey === "calories" ? settings.kcal : targets[seriesKey];
  const color = SERIES.find((x) => x.value === seriesKey)?.color ?? N.acc;

  const weights = data.weights;
  const recentWeights = weights.slice(-14);
  const change = weightChange(weights);
  const slope = weeklySlope(recentWeights);
  const adjustment =
    slope === null ? 0 : suggestCalorieAdjustment(settings.weeklyRate, slope);
  const latest = weights[weights.length - 1];

  async function logWeight() {
    const value = Number(weightText);
    const kg = toKg(value, weightUnit);

    if (!Number.isFinite(value) || kg < 20 || kg > 300) {
      showToast("Enter a weight between 20 and 300 kg");

      return;
    }

    if (await actions.logWeight(value)) setWeightText("");
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {ranges.length > 1 ? (
        <View style={s.gap}>
          <Seg
            value={range.id}
            onChange={setRangeId}
            options={ranges.map((r) => ({ value: r.id, label: r.label }))}
          />
        </View>
      ) : null}

      {logged.length === 0 ? (
        <NCard>
          <Text style={s.body}>
            Nothing logged in this range yet. Log a few meals and your trends
            show up here.
          </Text>
        </NCard>
      ) : (
        <>
          <NCard style={s.gap}>
            <View style={s.summary}>
              <Summary label="Avg calories" value={fmtInt(averageOf(logged, "calories"))} />
              <Summary label="Avg protein" value={`${Math.round(averageOf(logged, "protein"))}g`} />
              <Summary label="On target" value={`${daysOnTarget(logged)}/${logged.length}`} />
            </View>
          </NCard>

          <NCard style={s.gap}>
            <View style={s.gap}>
              <Seg
                value={seriesKey}
                onChange={setSeriesKey}
                options={SERIES.map(({ value, label }) => ({ value, label }))}
              />
            </View>
            <BarChart data={series} color={color} target={target} />
            <Text style={s.mute}>
              Averages over logged days. Dashed line is your{" "}
              {seriesKey === "calories" ? "calorie" : seriesKey} target.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Why did my targets change?"
              onPress={() => {
                tap();
                setChangeLogOpen(true);
              }}
              style={s.whyBtn}
            >
              <Text style={s.whyLink}>Why did my targets change? ›</Text>
            </Pressable>
          </NCard>

          <NCard style={s.gap}>
            <Label>Meal by meal</Label>
            {rows.map((row) => {
              const feel = FEEL_OPTIONS.find((o) => Math.round(row.feel) === o.value);

              return (
                <View key={row.slot} style={s.mealRow}>
                  <View style={s.mealHead}>
                    <Text style={s.body}>{row.slot}</Text>
                    <Text style={s.mute}>
                      {fmtInt(row.calories)} kcal · {Math.round(row.protein)}g
                      {feel ? ` · ${feel.label.toLowerCase()}` : ""}
                    </Text>
                  </View>
                  <Bar value={row.protein} max={Math.max(1, settings.protein / 3)} color={N.protein} />
                </View>
              );
            })}
            {weakest && weakest.protein < settings.protein / 5 ? (
              <Text style={s.mute}>
                {weakest.slot} is your lightest meal for protein.
              </Text>
            ) : null}
          </NCard>
        </>
      )}

      <NCard style={s.gap}>
        <View style={s.rowBetween}>
          <Label>Your week</Label>
        </View>
        <Text style={s.body}>
          Patterns and a few concrete changes from your last two weeks.
        </Text>
        <View style={s.top}>
          <Button label="Read my week" kind="ghost" onPress={() => setReadOpen(true)} />
        </View>
      </NCard>

      <NCard style={s.gap}>
        <Label>Weight</Label>
        {latest ? (
          <>
            <Text style={s.weight}>{formatWeight(latest.kg, weightUnit)}</Text>
            <Text style={s.mute}>
              {dayTitle(latest.key, todayKey)}
              {change
                ? ` · ${change.deltaKg >= 0 ? "+" : ""}${Math.round(fromKg(change.deltaKg, weightUnit) * 10) / 10} ${weightUnit} since ${dayTitle(change.sinceKey, todayKey)}`
                : ""}
            </Text>
            <LineChart values={weights.slice(-30).map((w) => fromKg(w.kg, weightUnit))} />
          </>
        ) : (
          <Text style={s.body}>No weigh-ins yet. Log one to see your trend.</Text>
        )}
        <View style={s.weightRow}>
          <View style={s.fill}>
            <Field
              value={weightText}
              onChangeText={setWeightText}
              placeholder={`Today's weight (${weightUnit})`}
              keyboardType="decimal-pad"
            />
          </View>
          <Button label="Log" onPress={() => void logWeight()} style={s.logBtn} />
        </View>
        {slope !== null ? (
          <Text style={s.mute}>
            Trend: {slope >= 0 ? "+" : ""}
            {(Math.round(fromKg(slope, weightUnit) * 100) / 100).toFixed(2)} {weightUnit}/week against a goal of{" "}
            {settings.weeklyRate >= 0 ? "+" : ""}
            {Math.round(fromKg(settings.weeklyRate, weightUnit) * 100) / 100} {weightUnit}/week.
          </Text>
        ) : weights.length > 0 ? (
          <Text style={s.mute}>A week of weigh-ins unlocks your trend.</Text>
        ) : null}
        {adjustment !== 0 ? (
          <View style={s.top}>
            <Button
              label={`Change calories ${adjustment > 0 ? "+" : ""}${adjustment} to ${settings.kcal + adjustment}`}
              onPress={() =>
                onChangeSettings(
                  { kcal: settings.kcal + adjustment },
                  `Calories ${settings.kcal} → ${settings.kcal + adjustment} (weight trend)`,
                )
              }
            />
          </View>
        ) : null}
        {recentWeights.length > 0 ? (
          <View style={s.chips}>
            {[...recentWeights].reverse().map((w) => (
              <Pressable
                key={w.id}
                accessibilityLabel={`Delete weight from ${dayTitle(w.key, todayKey)}`}
                onPress={() => {
                  tap();
                  const targetWeight = w;
                  void actions.removeWeight(w.id).then((ok) => {
                    if (ok) {
                      showUndoToast({
                        message: "Weight removed",
                        onUndo: () => {
                          void actions.restoreWeight(targetWeight);
                        },
                      });
                    }
                  });
                }}
                style={s.chip}
              >
                <Text style={s.mute}>
                  {dayTitle(w.key, todayKey)} {formatWeight(w.kg, weightUnit)} ✕
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </NCard>

      <WeeklyReadSheet visible={readOpen} onClose={() => setReadOpen(false)} read={read} />
      <ChangeLogSheet
        visible={changeLogOpen}
        onClose={() => setChangeLogOpen(false)}
        changeLog={settings.changeLog}
      />
    </ScrollView>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryItem}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.mute}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 0, paddingVertical: 8, paddingBottom: 40 },
  fill: { flex: 1 },
  whyBtn: { marginTop: 8, alignSelf: "flex-start" },
  whyLink: { color: N.acc, fontSize: 13, fontWeight: "600" },
  gap: { marginBottom: 12 },
  top: { marginTop: 12 },
  body: { color: N.ink, fontSize: 15, lineHeight: 21 },
  mute: { color: N.mute, fontSize: 13, lineHeight: 18 },
  summary: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontFamily: NSerif, fontWeight: "300", fontSize: 26, color: N.ink },
  mealRow: { marginBottom: 14 },
  mealHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  weight: { fontFamily: NSerif, fontWeight: "300", fontSize: 34, color: N.ink },
  weightRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 12 },
  logBtn: { marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: N.card2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
