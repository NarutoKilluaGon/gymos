import { ChevronLeft, ChevronRight, Plus, Send } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  EditEntrySheet,
  ManualSheet,
  ReviewSheet,
} from "@/components/nutrition/log-sheets";
import {
  CardioSheet,
  MicrosSheet,
  SavedSheet,
  SuggestionsSheet,
} from "@/components/nutrition/more-sheets";
import {
  Bar,
  NCard,
  Pill,
  Ring,
  fmtInt,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius, NSerif } from "@/constants/nourish-theme";
import { useFoodLogger } from "@/hooks/use-food-logger";
import type { useNourish } from "@/hooks/use-nourish";
import { useTodayKey } from "@/hooks/use-today-key";
import { dayHeading, dayTitle, FEEL_OPTIONS } from "@/services/nourish/format";
import { confidenceLabel, confidenceOf } from "@/services/nourish/nutrition";
import { slotOfMeal, timeOfDay } from "@/services/nourish/slots";
import { savedFoodToDraft } from "@/services/nourish/resolve-log";
import {
  catalogCandidates,
  suggestProteinOptions,
  type Suggestion,
  type SuggestionCandidate,
} from "@/services/nourish/suggestions";
import { isSavedMeal, type SavedFood } from "@/storage/repositories/saved-foods";
import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { addDaysToKey, dateKeyFromTimestamp, getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;

export function TodayView({ nourish }: { nourish: Nourish }) {
  const { data, model, actions, records, weightKg } = nourish;
  const todayKey = useTodayKey();
  // null follows "today" (so it rolls over at midnight); a string is a past
  // day the user deliberately navigated to and stays put.
  const [picked, setPicked] = useState<string | null>(null);
  const dayKey = picked ?? todayKey;
  const [input, setInput] = useState("");
  const [cardioText, setCardioText] = useState<string | null>(null);
  const [microsOpen, setMicrosOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const day = model(dayKey);
  const prevKey = addDaysToKey(dayKey, -1);
  const prevMeals = records?.get(prevKey)?.meals ?? [];

  const filled = useMemo(
    () =>
      new Set<MealSlot>(
        (day?.meals ?? []).map((meal) => slotOfMeal(meal)),
      ),
    [day],
  );

  // Resolved from the clock at tap time, never from render state, so a stale
  // render can't file a new entry under yesterday. A picked past day stays.
  const resolveDay = useCallback(() => {
    const now = getTodayKey();
    const wanted = picked ?? now;

    return wanted < now ? wanted : now;
  }, [picked]);

  const openCardio = useCallback((text: string) => {
    setInput("");
    setCardioText(text);
  }, []);

  const logger = useFoodLogger({
    dayKey,
    resolveDay,
    saved: data?.saved ?? [],
    filled,
    save: actions.logDraft,
    onCardioText: openCardio,
  });

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!data || !day || !ideasOpen) return [];

    const usual: SuggestionCandidate[] = data.saved
      .filter((food) => !isSavedMeal(food))
      .map((food) => ({
        name: food.name,
        qty: food.qty ?? "1 serving",
        calories: food.calories ?? 0,
        protein: food.protein ?? 0,
        carbs: food.carbs ?? 0,
        fat: food.fat ?? 0,
        origin: "saved" as const,
      }));

    return suggestProteinOptions({
      gapGrams: day.proteinGap,
      kcalLeft: day.remaining,
      prefs: data.settings.prefs,
      candidates: [...usual, ...catalogCandidates()],
    });
  }, [data, day, ideasOpen]);

  if (!data || !day) {
    return (
      <View style={s.loading}>
        <Text style={s.mute}>Loading…</Text>
      </View>
    );
  }

  const isToday = dayKey === todayKey;
  const { totals, targets } = day;
  const allowance = day.budget - data.settings.kcal;
  const uncertainty = Math.round(totals.uncertainty / 10) * 10;
  const over = day.remaining < 0;

  function stepDay(delta: number) {
    const next = addDaysToKey(dayKey, delta);

    setPicked(next < todayKey ? next : null);
  }

  /** Copy the day before the one being logged to, resolved at tap time. */
  function repeatPrevious() {
    const target = resolveDay();
    const source = records?.get(addDaysToKey(target, -1))?.meals ?? [];

    if (source.length > 0) void actions.repeatInto(source, target);
  }

  async function send() {
    const handled = await logger.submit(input);

    if (handled) setInput("");
  }

  function logSuggestion(suggestion: Suggestion) {
    const item: DraftItem = {
      name: suggestion.name,
      qty: suggestion.qty,
      calories: suggestion.calories,
      protein: suggestion.protein,
      carbs: suggestion.carbs,
      fat: suggestion.fat,
      confidence: suggestion.origin === "saved" ? 0.9 : 0.85,
      multiplier: 1,
      source: suggestion.origin === "saved" ? "saved" : "catalog",
    };

    setIdeasOpen(false);
    logger.openReview([item]);
  }

  function logFromSaved(food: SavedFood) {
    setSavedOpen(false);

    if (isSavedMeal(food)) {
      void actions.logSaved(food, resolveDay());
    } else {
      logger.openReview([savedFoodToDraft(food)]);
    }
  }

  return (
    <View style={s.fill}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.dayRow}>
          <Pressable
            accessibilityLabel="Previous day"
            hitSlop={12}
            onPress={() => {
              tap();
              stepDay(-1);
            }}
          >
            <ChevronLeft size={24} color={N.mute} />
          </Pressable>
          <View style={s.dayTitleWrap}>
            <Text style={s.dayTitle}>{dayTitle(dayKey, todayKey)}</Text>
            <Text style={s.mute}>{dayHeading(dayKey)}</Text>
          </View>
          <Pressable
            accessibilityLabel="Next day"
            hitSlop={12}
            disabled={isToday}
            onPress={() => {
              tap();
              stepDay(1);
            }}
            style={isToday && s.hidden}
          >
            <ChevronRight size={24} color={N.mute} />
          </Pressable>
        </View>

        <NCard style={s.hero}>
          <Ring value={totals.calories} max={day.budget} size={136}>
            <Text style={[s.ringNumber, over && { color: N.bad }]}>
              {fmtInt(Math.abs(day.remaining))}
            </Text>
            <Text style={s.mute}>{over ? "kcal over" : "kcal left"}</Text>
          </Ring>
          <View style={s.stats}>
            <Stat
              label="Eaten"
              value={fmtInt(totals.calories)}
              note={uncertainty > 40 ? `±${uncertainty}` : undefined}
            />
            <Stat
              label="Budget"
              value={fmtInt(day.budget)}
              note={allowance > 0 ? `+${fmtInt(allowance)} cardio` : undefined}
            />
            <Stat label="Burned" value={fmtInt(day.burnKcal)} />
          </View>
        </NCard>

        <Pressable onPress={() => setMicrosOpen(true)} accessibilityRole="button">
          <NCard style={s.macros}>
            <MacroRow label="Protein" color={N.protein} value={totals.protein} target={targets.protein} />
            <MacroRow label="Carbs" color={N.carbs} value={totals.carbs} target={targets.carbs} />
            <MacroRow label="Fat" color={N.fat} value={totals.fat} target={targets.fat} />
            <Text style={s.microLink}>Micronutrients ›</Text>
          </NCard>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          {prevMeals.length > 0 ? (
            <Pill
              label={`Repeat ${dayTitle(prevKey, todayKey).toLowerCase()}`}
              onPress={repeatPrevious}
            />
          ) : null}
          <Pill label="Saved" onPress={() => setSavedOpen(true)} />
          <Pill label="Add manually" onPress={() => logger.openManual()} />
          <Pill
            label="Eating out"
            active={logger.eatingOut}
            onPress={() => logger.setEatingOut(!logger.eatingOut)}
          />
          {day.proteinGap > 0 && day.meals.length > 0 ? (
            <Pill
              label={`${Math.round(day.proteinGap)}g protein to go`}
              onPress={() => setIdeasOpen(true)}
            />
          ) : null}
        </ScrollView>

        {MEAL_SLOTS.map((slot) => {
          const entries = day.bySlot[slot];
          const kcal = entries.reduce((sum, m) => sum + (m.calories ?? 0), 0);
          const protein = entries.reduce((sum, m) => sum + (m.protein ?? 0), 0);

          return (
            <View key={slot} style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>{slot}</Text>
                <Text style={s.mute}>
                  {entries.length > 0
                    ? `${fmtInt(kcal)} kcal · ${Math.round(protein)}g protein`
                    : ""}
                </Text>
              </View>
              {entries.length === 0 ? (
                <Text style={s.empty}>Nothing yet</Text>
              ) : (
                <NCard style={s.rows}>
                  {entries.map((meal, index) => (
                    <EntryRow
                      key={meal.id}
                      meal={meal}
                      last={index === entries.length - 1}
                      onPress={() => setEditing(meal)}
                    />
                  ))}
                  <View style={s.feelRow}>
                    {FEEL_OPTIONS.map((option) => (
                      <Pill
                        key={option.value}
                        label={option.label}
                        active={day.feel[slot] === option.value}
                        onPress={() =>
                          void actions.setFeel(dayKey, slot, option.value)
                        }
                      />
                    ))}
                    <Pill
                      label="Save meal"
                      onPress={() =>
                        void actions
                          .saveSection(entries, slot)
                          .then((ok) => {
                            if (ok) showToast("Saved to Saved › Meals", "success");
                          })
                      }
                    />
                  </View>
                </NCard>
              )}
            </View>
          );
        })}

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Cardio</Text>
            <Pill
              label="Cardio"
              icon={<Plus size={14} color={N.ink} />}
              onPress={() => setCardioText("")}
            />
          </View>
          {day.burn.length === 0 ? (
            <Text style={s.empty}>
              Log cardio to add part of it back to today’s budget.
            </Text>
          ) : (
            <NCard style={s.rows}>
              {day.burn.map((entry, index) => (
                <View
                  key={entry.id}
                  style={[s.entry, index < day.burn.length - 1 && s.entryLine]}
                >
                  <View style={s.entryMain}>
                    <Text style={s.entryName}>{entry.name}</Text>
                    <Text style={s.mute}>
                      {[entry.detail, entry.source === "workouts" ? "from Workouts" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Text style={s.entryKcal}>{fmtInt(entry.kcal)} kcal</Text>
                  {entry.removable ? (
                    <Pressable
                      accessibilityLabel={`Remove ${entry.name}`}
                      hitSlop={10}
                      onPress={() => {
                        tap();
                        void actions.removeCardio(dayKey, entry.id);
                      }}
                    >
                      <Text style={s.remove}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </NCard>
          )}
        </View>
      </ScrollView>

      <View style={s.dock}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Log anything: 2 rotis, dal, paneer bhurji"
          placeholderTextColor={N.dim}
          selectionColor={N.acc}
          style={s.dockInput}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          editable={!logger.busy}
          accessibilityLabel="Log food or cardio"
        />
        <Pressable
          accessibilityLabel="Log"
          accessibilityState={{ disabled: logger.busy || input.trim() === "" }}
          disabled={logger.busy || input.trim() === ""}
          onPress={() => {
            tap();
            void send();
          }}
          style={[s.send, (logger.busy || input.trim() === "") && s.sendOff]}
        >
          <Send size={18} color={N.accInk} />
        </Pressable>
      </View>
      {logger.busy ? <Text style={s.working}>Working it out…</Text> : null}

      <ReviewSheet logger={logger} />
      <ManualSheet logger={logger} />
      <EditEntrySheet
        meal={editing}
        initialSlot={editing ? slotOfMeal(editing) : "Snacks"}
        initialAt={editing ? (timeOfDay(editing.timestamp) ?? "") : ""}
        busy={editBusy}
        onClose={() => setEditing(null)}
        onSave={(factor, slot, at) => {
          if (!editing) return;

          setEditBusy(true);
          void actions
            .editEntry(editing, {
              factor,
              slot,
              at,
              // The entry's own persisted day, not the one on screen, so an
              // edit left open across midnight can't move it.
              dayKey: dateKeyFromTimestamp(editing.timestamp) ?? dayKey,
            })
            .then((ok) => {
              if (ok) setEditing(null);
            })
            .finally(() => setEditBusy(false));
        }}
        onDelete={() => {
          if (!editing) return;

          void actions.removeEntry(editing.id).then((ok) => {
            if (ok) setEditing(null);
          });
        }}
      />
      <CardioSheet
        visible={cardioText !== null}
        onClose={() => setCardioText(null)}
        initialText={cardioText ?? ""}
        weightKg={weightKg}
        onSave={(entry) => actions.addCardio(resolveDay(), entry)}
      />
      <MicrosSheet
        visible={microsOpen}
        onClose={() => setMicrosOpen(false)}
        totals={totals}
      />
      <SuggestionsSheet
        visible={ideasOpen}
        onClose={() => setIdeasOpen(false)}
        suggestions={suggestions}
        gapGrams={day.proteinGap}
        onLog={logSuggestion}
      />
      <SavedSheet
        visible={savedOpen}
        onClose={() => setSavedOpen(false)}
        foods={data.saved}
        onLog={logFromSaved}
        onDelete={(food) => void actions.removeSaved(food.id)}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value}
        {note ? <Text style={s.statNote}> {note}</Text> : null}
      </Text>
    </View>
  );
}

function MacroRow({
  label,
  color,
  value,
  target,
}: {
  label: string;
  color: string;
  value: number;
  target: number;
}) {
  return (
    <View style={s.macro}>
      <View style={s.macroHead}>
        <Text style={s.macroLabel}>{label}</Text>
        <Text style={s.mute}>
          {Math.round(value)} / {target}g
        </Text>
      </View>
      <Bar value={value} max={target} color={color} />
    </View>
  );
}

function EntryRow({
  meal,
  last,
  onPress,
}: {
  meal: Meal;
  last: boolean;
  onPress: () => void;
}) {
  const conf = confidenceLabel(confidenceOf(meal));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${meal.name}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[s.entry, !last && s.entryLine]}
    >
      <View style={s.entryMain}>
        <Text style={s.entryName}>{meal.name}</Text>
        <View style={s.entrySub}>
          <View style={[s.dot, { backgroundColor: conf.color }]} />
          <Text style={s.mute}>
            {meal.qty ?? "1 serving"} · {Math.round(meal.protein ?? 0)}g protein
          </Text>
        </View>
      </View>
      <Text style={s.entryKcal}>{fmtInt(meal.calories ?? 0)} kcal</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 110 },
  mute: { color: N.mute, fontSize: 13 },
  hidden: { opacity: 0 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  dayTitleWrap: { alignItems: "center" },
  dayTitle: { fontFamily: NSerif, fontWeight: "300", fontSize: 32, color: N.ink },
  hero: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 12 },
  ringNumber: { fontFamily: NSerif, fontWeight: "300", fontSize: 30, color: N.ink },
  stats: { flex: 1, gap: 10 },
  stat: {},
  statLabel: {
    color: N.mute,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: { color: N.ink, fontSize: 18, fontWeight: "500" },
  statNote: { color: N.mute, fontSize: 12, fontWeight: "400" },
  macros: { gap: 12, marginBottom: 12 },
  macro: {},
  macroHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  macroLabel: { color: N.ink, fontSize: 14 },
  microLink: { color: N.acc, fontSize: 13, alignSelf: "flex-end" },
  chips: { gap: 8, paddingVertical: 6, paddingRight: 20 },
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: NSerif, fontWeight: "300", fontSize: 22, color: N.ink },
  empty: { color: N.dim, fontSize: 14, paddingVertical: 6 },
  rows: { padding: 0, overflow: "hidden" },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  entryLine: { borderBottomWidth: 1, borderBottomColor: N.line },
  entryMain: { flex: 1 },
  entryName: { color: N.ink, fontSize: 15, fontWeight: "500" },
  entrySub: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  entryKcal: { color: N.ink, fontSize: 14 },
  remove: { color: N.dim, fontSize: 16, paddingHorizontal: 4 },
  feelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  dock: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: N.card,
    borderRadius: NRadius.pill,
    borderWidth: 1,
    borderColor: N.line,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  dockInput: { flex: 1, color: N.ink, fontSize: 15, paddingVertical: 8 },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: N.acc,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
  working: {
    position: "absolute",
    bottom: 68,
    alignSelf: "center",
    color: N.mute,
    fontSize: 12,
  },
});
