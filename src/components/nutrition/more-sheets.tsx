import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Bar,
  Button,
  Field,
  Seg,
  Sheet,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import { estimateCardio } from "@/services/nourish/cardio";
import { MICRO_SPECS, type DayTotals } from "@/services/nourish/nutrition";
import type { Suggestion } from "@/services/nourish/suggestions";
import type { WeeklyRead } from "@/services/nourish/weekly-read";
import { isSavedMeal, type SavedFood } from "@/storage/repositories/saved-foods";
import type { CardioLog } from "@/types/nourish";

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
  const [kcalText, setKcalText] = useState("");
  const [busy, setBusy] = useState(false);
  const estimate = useMemo(
    () => estimateCardio(text, weightKg),
    [text, weightKg],
  );
  const override = Number(kcalText);
  const hasOverride = kcalText.trim() !== "" && Number.isFinite(override) && override > 0;
  const kcal = hasOverride ? Math.round(override) : (estimate?.kcal ?? 0);

  return (
    <View>
      <Field
        label="What did you do?"
        value={text}
        onChangeText={setText}
        placeholder="30 min walk, 5 km run, 19 floors x 10"
        autoFocus
      />
      {estimate ? (
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
            void onSave({
              name: estimate?.name ?? (text.trim() || "Cardio"),
              detail: estimate?.detail ?? "",
              minutes: estimate?.minutes ?? 0,
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

type SavedTab = "meals" | "foods" | "recipes";

/** Saved meals, remembered foods and recipes. With `onLog` it logs on tap;
 *  without it (Hub) it only manages the list. */
export function SavedSheet({
  visible,
  onClose,
  foods,
  onLog,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  foods: readonly SavedFood[];
  onLog?: (food: SavedFood) => void;
  onDelete: (food: SavedFood) => void;
}) {
  const [tab, setTab] = useState<SavedTab>("meals");
  const [armed, setArmed] = useState<string | null>(null);

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
    <Sheet visible={visible} onClose={onClose} title="Saved">
      <View style={s.segWrap}>
        <Seg
          value={tab}
          onChange={(next) => {
            setTab(next);
            setArmed(null);
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
            ? "Save a meal from the ⋯ on any meal section in Today."
            : tab === "foods"
              ? "Foods you confirm appear here, ready to reuse."
              : "Build a recipe in Kitchen and it shows up here."}
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

                if (armed === food.id) {
                  setArmed(null);
                  onDelete(food);
                } else {
                  setArmed(food.id);
                }
              }}
            >
              <Text style={[s.del, armed === food.id && { color: N.bad }]}>
                {armed === food.id ? "Delete?" : "✕"}
              </Text>
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
});
