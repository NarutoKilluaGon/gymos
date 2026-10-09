import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ChangeLogSheet } from "@/components/nutrition/more-sheets";
import { Button, Field, Label, NCard, Seg, tap } from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import type { useNourish } from "@/hooks/use-nourish";
import { dayTitle } from "@/services/nourish/format";
import { CARDIO_RETURNS, SPLITS, describeChanges } from "@/services/nourish/targets";
import { fromKg, toKg } from "@/services/nourish/weight";
import type { NourishSettings } from "@/types/nourish";
import { dateKeyFromTimestamp, getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;

const SPLIT_LABELS: Record<string, string> = {
  "45,25": "45/25",
  "40,30": "40/30",
  "50,20": "50/20",
};

export function MeView({
  nourish,
  onChangeSettings,
}: {
  nourish: Nourish;
  onChangeSettings: (patch: Partial<NourishSettings>, description: string) => void;
}) {
  const { data, actions, weightUnit } = nourish;

  if (!data) return <Text style={s.mute}>Loading…</Text>;

  return (
    <MeForm
      key={data.settings.changeLog.length}
      settings={data.settings}
      weightUnit={weightUnit}
      onChangeSettings={onChangeSettings}
      onSavePrefs={(prefs) =>
        void actions
          .saveSettings({ ...data.settings, prefs })
          .then((ok) => ok && showToast("Notes saved", "success"))
      }
    />
  );
}

function MeForm({
  settings,
  weightUnit,
  onChangeSettings,
  onSavePrefs,
}: {
  settings: NourishSettings;
  weightUnit: "kg" | "lb";
  onChangeSettings: (patch: Partial<NourishSettings>, description: string) => void;
  onSavePrefs: (prefs: string) => void;
}) {
  const [kcal, setKcal] = useState(String(settings.kcal));
  const [protein, setProtein] = useState(String(settings.protein));
  const [split, setSplit] = useState(settings.split);
  const [ret, setRet] = useState(settings.cardioReturn);
  const [rate, setRate] = useState(
    String(Math.round(fromKg(settings.weeklyRate, weightUnit) * 100) / 100),
  );
  const [prefs, setPrefs] = useState(settings.prefs);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const todayKey = getTodayKey();

  function save() {
    const nextKcal = Math.round(Number(kcal));
    const nextProtein = Math.round(Number(protein));
    const nextRate = toKg(Number(rate), weightUnit);

    if (!(nextKcal >= 800 && nextKcal <= 8000)) {
      showToast("Calories should be between 800 and 8000");

      return;
    }

    if (!(nextProtein >= 20 && nextProtein <= 500)) {
      showToast("Protein should be between 20 and 500 g");

      return;
    }

    if (!Number.isFinite(nextRate) || Math.abs(nextRate) > 2) {
      showToast("Weekly weight change should be within ±2 kg");

      return;
    }

    const patch: Partial<NourishSettings> = {
      kcal: nextKcal,
      protein: nextProtein,
      split,
      cardioReturn: ret,
      weeklyRate: Math.round(nextRate * 100) / 100,
    };
    const changes = describeChanges(settings, { ...settings, ...patch });

    if (changes.length === 0) {
      showToast("No changes to save", "success");

      return;
    }

    onChangeSettings(patch, changes.join(", "));
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <NCard style={s.gap}>
        <Label>Daily targets</Label>
        <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
        <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
        <Label>Carb / fat split (% of calories)</Label>
        <View style={s.gap}>
          <Seg value={split} onChange={setSplit} options={SPLITS.map((v) => ({ value: v, label: SPLIT_LABELS[v] ?? v }))} />
        </View>
        <Label>Cardio added back</Label>
        <View style={s.gap}>
          <Seg value={ret} onChange={setRet} options={CARDIO_RETURNS.map((o) => ({ value: o.value, label: o.label }))} />
        </View>
        <Field
          label={`Weight goal (${weightUnit} per week, negative to lose)`}
          value={rate}
          onChangeText={setRate}
          keyboardType="numbers-and-punctuation"
        />
        <Button label="Save targets" onPress={save} />
        <View style={s.guardBox}>
          <Text style={s.guardText}>
            Targets are guarded: changes are tracked and editing within 14 days asks for confirmation so your metabolism has time to adapt before shifting targets again.
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
        </View>
      </NCard>

      <NCard style={s.gap}>
        <Label>Nutrition memory</Label>
        <Text style={[s.mute, s.gap]}>
          Dislikes and restrictions, like “vegetarian, no mushrooms”. Used to
          filter protein ideas.
        </Text>
        <TextInput
          value={prefs}
          onChangeText={setPrefs}
          multiline
          placeholder="Vegetarian, eggs are fine, no mushrooms"
          placeholderTextColor={N.dim}
          selectionColor={N.acc}
          style={s.area}
        />
        <Button label="Save notes" kind="ghost" onPress={() => onSavePrefs(prefs)} disabled={prefs === settings.prefs} />
      </NCard>

      <NCard style={s.gap}>
        <Label>Change history</Label>
        {settings.changeLog.length === 0 ? (
          <Text style={s.mute}>No target changes yet.</Text>
        ) : (
          [...settings.changeLog].reverse().map((entry) => {
            const key = dateKeyFromTimestamp(entry.date);

            return (
              <View key={entry.date + entry.change} style={s.log}>
                <Text style={s.mute}>{key ? dayTitle(key, todayKey) : entry.date}</Text>
                <Text style={s.body}>{entry.change}</Text>
              </View>
            );
          })
        )}
      </NCard>

      <Text style={s.mute}>
        Backup and restore live in Hub › Export, which includes everything
        here.
      </Text>

      <ChangeLogSheet
        visible={changeLogOpen}
        onClose={() => setChangeLogOpen(false)}
        changeLog={settings.changeLog}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 0, paddingVertical: 8, paddingBottom: 40 },
  gap: { marginBottom: 12 },
  mute: { color: N.mute, fontSize: 13, lineHeight: 18 },
  body: { color: N.ink, fontSize: 14, lineHeight: 20 },
  log: { marginBottom: 10 },
  area: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    color: N.ink,
    fontSize: 15,
    minHeight: 90,
    padding: 14,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  guardBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  guardText: {
    color: N.mute,
    fontSize: 12,
    lineHeight: 17,
  },
  whyBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  whyLink: {
    color: N.acc,
    fontSize: 13,
    fontWeight: "600",
  },
});
