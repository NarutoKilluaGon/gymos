import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Bar,
  Button,
  Field,
  Pill,
  Seg,
  Sheet,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import { CARDIO_ACTIVITIES } from "@/data/cardio";
import { estimateCardio } from "@/services/nourish/cardio";
import { MICRO_SPECS, type DayTotals } from "@/services/nourish/nutrition";
import type { Suggestion } from "@/services/nourish/suggestions";
import type { WeeklyRead } from "@/services/nourish/weekly-read";
import { dayTitle } from "@/services/nourish/format";
import { isSavedMeal, type SavedFood } from "@/storage/repositories/saved-foods";
import type { CardioLog, ChangeLogEntry } from "@/types/nourish";
import { dateKeyFromTimestamp, getTodayKey } from "@/utils/date";

export function CardioSheet({
  visible,
  onClose,
  initialText,
  weightKg,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initialText: string;
  weightKg: number;
  onSave: (entry: Omit<CardioLog, "id" | "loggedAt">) => Promise<boolean>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Log cardio">
      <CardioForm
        initialText={initialText}
        weightKg={weightKg}
        onSave={async (entry) => {
          if (await onSave(entry)) onClose();
        }}
        onCancel={onClose}
      />
    </Sheet>
  );
}

const COMMON_CHIPS = [
  "Walk",
  "Run",
  "Cycle",
  "Elliptical",
  "Stairmaster",
  "Rowing",
  "Swim",
  "HIIT",
  "Jump rope",
] as const;

function CardioForm({
  initialText,
  weightKg,
  onSave,
  onCancel,
}: {
  initialText: string;
  weightKg: number;
  onSave: (entry: Omit<CardioLog, "id" | "loggedAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [debouncedText, setDebouncedText] = useState(initialText);
  const [kcalText, setKcalText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const delay = process.env.NODE_ENV === "test" ? 0 : 400;
    const timer = setTimeout(() => {
      setDebouncedText(text);
    }, delay);
    return () => clearTimeout(timer);
  }, [text]);

  const estimate = useMemo(
    () => estimateCardio(debouncedText, weightKg),
    [debouncedText, weightKg],
  );

  const override = Number(kcalText);
  const hasOverride =
    kcalText.trim() !== "" && Number.isFinite(override) && override > 0;
  const kcal = hasOverride ? Math.round(override) : (estimate?.kcal ?? 0);

  const handleChipPress = (label: string) => {
    tap();
    const clean = text.trim();
    if (!clean) {
      setText(`${label} `);
      return;
    }
    // If text already has time/distance, prepend or replace activity
    const hasActivity = CARDIO_ACTIVITIES.some((a) =>
      a.aliases.some((al) => new RegExp(`\\b${al}\\b`, "i").test(clean)),
    );
    if (!hasActivity) {
      setText(`${label} ${clean}`);
    } else {
      // Replace existing activity
      setText(`${label} ${clean}`);
    }
  };

  return (
    <View>
      <Field
        label="What did you do?"
        value={text}
        onChangeText={setText}
        placeholder="30 min walk, 5 km run, 10 min elliptical"
        autoFocus
      />

      {/* Activity Chips Shelf */}
      <View style={s.chipShelf}>
        {COMMON_CHIPS.map((chip) => (
          <Pill
            key={chip}
            label={chip}
            active={estimate?.name.toLowerCase() === chip.toLowerCase()}
            onPress={() => handleChipPress(chip)}
          />
        ))}
      </View>

      {estimate && !estimate.needsActivity ? (
        <View style={s.estimate}>
          <Text style={s.estName}>
            {estimate.name} · {estimate.detail}
          </Text>
          <Text style={s.estKcal}>~{estimate.kcal} kcal</Text>
          <Text style={s.hint}>
            Based on {Math.round(weightKg)} kg body weight. Adjust below if
            your watch says otherwise.
          </Text>
        </View>
      ) : estimate?.needsActivity ? (
        <View style={s.estimate}>
          <Text style={s.hintWarning}>
            I couldn&apos;t tell the activity — pick one above
          </Text>
          <Text style={s.estName}>
            {estimate.name} · {estimate.detail}
          </Text>
          <Text style={s.estKcal}>~{estimate.kcal} kcal (estimate)</Text>
        </View>
      ) : (
        <Text style={s.hint}>
          Add a time or distance, like “30 min walk” or “5 km run”, or enter
          the calories yourself.
        </Text>
      )}

      <Field
        label="Calories burned (optional override)"
        value={kcalText}
        onChangeText={setKcalText}
        keyboardType="number-pad"
        placeholder={estimate ? String(estimate.kcal) : "kcal"}
      />
      <View style={s.buttons}>
        <Button
          label={kcal > 0 ? `Save ${kcal} kcal` : "Save"}
          busy={busy}
          disabled={kcal <= 0}
          onPress={() => {
            setBusy(true);
            const savedName = estimate
              ? `${estimate.name} · ${estimate.detail}`
              : (text.trim() || "Cardio");

            void onSave({
              activity: estimate?.activity ?? "other",
              name: savedName,
              detail: estimate?.detail ?? "",
              minutes: estimate?.minutes ?? 0,
              durationMin: estimate?.minutes ?? 0,
              distanceKm: estimate?.distanceKm,
              kcal,
            }).finally(() => setBusy(false));
          }}
        />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

export function MicrosSheet({
  visible,
  onClose,
  totals,
}: {
  visible: boolean;
  onClose: () => void;
  totals: DayTotals;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Micronutrients">
      {MICRO_SPECS.map((spec) => {
        const value = totals[spec.key];
        const over = spec.kind === "limit" && value > spec.target;

        return (
          <View key={spec.key} style={s.microRow}>
            <View style={s.microHead}>
              <Text style={s.microName}>{spec.label}</Text>
              <Text style={s.microValue}>
                {Math.round(value)} / {spec.target}
                {spec.unit}
                {spec.kind === "limit" ? " max" : ""}
              </Text>
            </View>
            <Bar
              value={value}
              max={spec.target}
              color={over ? N.protein : spec.kind === "limit" ? N.fat : N.acc}
            />
          </View>
        );
      })}
      <Text style={s.hint}>
        Only foods with known values count. Totals can read low if some of
        your entries have no micronutrient data.
      </Text>
    </Sheet>
  );
}

export function SuggestionsSheet({
  visible,
  onClose,
  suggestions,
  gapGrams,
  onLog,
}: {
  visible: boolean;
  onClose: () => void;
  suggestions: readonly Suggestion[];
  gapGrams: number;
  onLog: (suggestion: Suggestion) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Close the protein gap">
      <Text style={s.hint}>
        {Math.round(gapGrams)}g of protein to go. These come from your usual
        foods and the food list, filtered by your notes in Me.
      </Text>
      {suggestions.length === 0 ? (
        <Text style={s.empty}>
          Nothing fits right now. Try a food manually, or loosen your notes.
        </Text>
      ) : (
        suggestions.map((suggestion) => (
          <View key={suggestion.name} style={s.listRow}>
            <View style={s.listMain}>
              <Text style={s.listName}>{suggestion.name}</Text>
              <Text style={s.listSub}>{suggestion.qty}</Text>
              <Text style={s.listSub}>{suggestion.why}</Text>
            </View>
            <Button
              label="Log"
              onPress={() => onLog(suggestion)}
              style={s.smallButton}
            />
          </View>
        ))
      )}
    </Sheet>
  );
}

export type SavedTab = "meals" | "foods" | "recipes";

/** Saved meals, remembered foods and recipes. With `onLog` it logs on tap;
 *  without it (Hub) it only manages the list. */
export function SavedSheet({
  visible,
  onClose,
  foods,
  onLog,
  onDelete,
  initialTab,
}: {
  visible: boolean;
  onClose: () => void;
  foods: readonly SavedFood[];
  onLog?: (food: SavedFood) => void;
  onDelete: (food: SavedFood) => void;
  initialTab?: SavedTab;
}) {
  const [userTab, setUserTab] = useState<SavedTab | null>(null);
  const tab = userTab ?? initialTab ?? "meals";

  const meals = foods.filter(isSavedMeal);
  const recipes = foods.filter((f) => f.recipe && !isSavedMeal(f));
  const singles = foods
    .filter((f) => !isSavedMeal(f) && !f.recipe)
    .sort(
      (a, b) =>
        (b.uses ?? 0) - (a.uses ?? 0) ||
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
    );
  const shown = tab === "meals" ? meals : tab === "recipes" ? recipes : singles;

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setUserTab(null);
        onClose();
      }}
      title="Saved"
    >
      <View style={s.segWrap}>
        <Seg
          value={tab}
          onChange={(next) => {
            setUserTab(next as SavedTab);
          }}
          options={[
            { value: "meals", label: `Meals ${meals.length}` },
            { value: "foods", label: `Foods ${singles.length}` },
            { value: "recipes", label: `Recipes ${recipes.length}` },
          ]}
        />
      </View>
      {shown.length === 0 ? (
        <Text style={s.empty}>
          {tab === "meals"
            ? "Build a meal here, or log food in Today and tap Save meal."
            : tab === "foods"
              ? "Foods you confirm show up here."
              : "Build a recipe from ingredients; it divides into servings."}
        </Text>
      ) : (
        shown.map((food) => (
          <View key={food.id} style={s.listRow}>
            <Pressable
              style={s.listMain}
              disabled={!onLog}
              onPress={() => {
                tap();
                onLog?.(food);
              }}
            >
              <Text style={s.listName}>{food.name}</Text>
              <Text style={s.listSub}>
                {Math.round(food.calories ?? 0)} kcal · P{" "}
                {Math.round(food.protein ?? 0)}
                {food.qty ? ` · ${food.qty}` : ""}
                {isSavedMeal(food) ? ` · ${food.foods?.length} items` : ""}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Delete ${food.name}`}
              hitSlop={10}
              onPress={() => {
                tap();
                onDelete(food);
              }}
            >
              <Text style={s.del}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
    </Sheet>
  );
}

export function WeeklyReadSheet({
  visible,
  onClose,
  read,
}: {
  visible: boolean;
  onClose: () => void;
  read: WeeklyRead | null;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Your week">
      {read ? (
        <View>
          <Text style={s.readSummary}>{read.summary}</Text>
          {read.actions.map((action) => (
            <View key={action.do} style={s.action}>
              <Text style={s.listName}>{action.do}</Text>
              <Text style={s.listSub}>{action.why}</Text>
            </View>
          ))}
          <Text style={s.hint}>
            Based on {read.basedOnDays} logged day
            {read.basedOnDays === 1 ? "" : "s"} in the last two weeks.
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

export function GuardSheet({
  visible,
  daysAgo,
  onKeep,
  onProceed,
}: {
  visible: boolean;
  daysAgo: number;
  onKeep: () => void;
  onProceed: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onKeep}
      title="Change targets again?"
      footer={
        <>
          <Button label="Keep current targets" onPress={onKeep} />
          <Button label="Change anyway" kind="ghost" onPress={onProceed} />
        </>
      }
    >
      <Text style={s.readSummary}>
        You last changed your targets {daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`}.
        Giving a target two weeks makes it much easier to tell whether it is
        working.
      </Text>
    </Sheet>
  );
}

export function ChangeLogSheet({
  visible,
  onClose,
  changeLog,
}: {
  visible: boolean;
  onClose: () => void;
  changeLog: readonly ChangeLogEntry[];
}) {
  const todayKey = getTodayKey();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Why did my targets change?"
    >
      <View style={s.guardCard}>
        <Text style={s.guardCardTitle}>14-day change guard</Text>
        <Text style={s.guardCardBody}>
          Target changes are guarded: your body and metabolism take up to 2 weeks to settle on a deficit or surplus. Holding targets for 14 days filters out daily water noise and lets you see your true rate of progress.
        </Text>
      </View>

      <Text style={s.logSectionTitle}>Target Change History</Text>
      {changeLog.length === 0 ? (
        <Text style={s.empty}>No target changes recorded yet.</Text>
      ) : (
        <View style={s.changeLogList}>
          {[...changeLog].reverse().map((entry, idx) => {
            const key = dateKeyFromTimestamp(entry.date);
            return (
              <View key={`${entry.date}-${idx}`} style={s.changeItem}>
                <Text style={s.changeDate}>
                  {key ? dayTitle(key, todayKey) : entry.date}
                </Text>
                <Text style={s.changeDesc}>{entry.change}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  estimate: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 14,
  },
  estName: { color: N.ink, fontSize: 15, fontWeight: "600" },
  estKcal: { color: N.acc, fontSize: 22, marginTop: 4 },
  hint: { color: N.mute, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  hintWarning: { color: N.acc, fontSize: 13, marginBottom: 8, fontWeight: "500" },
  chipShelf: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 10 },
  buttons: { gap: 8, marginTop: 4 },
  microRow: { marginBottom: 16 },
  microHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  microName: { color: N.ink, fontSize: 14 },
  microValue: { color: N.mute, fontSize: 13 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 10,
  },
  listMain: { flex: 1 },
  listName: { color: N.ink, fontSize: 15, fontWeight: "600" },
  listSub: { color: N.mute, fontSize: 13, marginTop: 2 },
  smallButton: { minHeight: 40, paddingHorizontal: 16 },
  empty: { color: N.mute, fontSize: 14, paddingVertical: 16, lineHeight: 20 },
  segWrap: { marginBottom: 14 },
  del: { color: N.dim, fontSize: 15, paddingHorizontal: 4 },
  readSummary: { color: N.ink, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  action: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 10,
  },
  guardCard: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 16,
  },
  guardCardTitle: {
    color: N.acc,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  guardCardBody: {
    color: N.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  logSectionTitle: {
    color: N.mute,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  changeLogList: {
    gap: 8,
    marginBottom: 12,
  },
  changeItem: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 12,
  },
  changeDate: {
    color: N.mute,
    fontSize: 12,
    marginBottom: 4,
  },
  changeDesc: {
    color: N.ink,
    fontSize: 14,
    lineHeight: 19,
  },
});
