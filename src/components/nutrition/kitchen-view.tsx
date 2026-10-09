import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Sheet } from "@/components/ds/sheet";
import { SavedSheet } from "@/components/nutrition/more-sheets";
import {
  Button,
  Field,
  Label,
  NCard,
  Pill,
  fmtInt,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import type { useNourish } from "@/hooks/use-nourish";
import { recipePerServing } from "@/services/nourish/diary";
import {
  resolveSegments,
  type SegmentResolution,
} from "@/services/nourish/resolve-log";
import { getDescriptionAiProvider } from "@/services/meal-description-ai-provider";
import { isSavedMeal } from "@/storage/repositories/saved-foods";
import type { DraftItem } from "@/types/nourish";
import { showToast, showUndoToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;

export function KitchenView({ nourish }: { nourish: Nourish }) {
  const { data, actions } = nourish;
  const [savedOpen, setSavedOpen] = useState(false);
  const [name, setName] = useState("");
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState("");
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [resolutions, setResolutions] = useState<SegmentResolution[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Manual entry modal for unresolved ingredient
  const [manualModalIndex, setManualModalIndex] = useState<number | null>(null);
  const [manualKcal, setManualKcal] = useState("");
  const [manualP, setManualP] = useState("");
  const [manualC, setManualC] = useState("");
  const [manualF, setManualF] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [rememberChecked, setRememberChecked] = useState(true);
  const [aiLoadingIndex, setAiLoadingIndex] = useState<number | null>(null);

  if (!data) return <Text style={s.mute}>Loading…</Text>;

  const meals = data.saved.filter(isSavedMeal).length;
  const recipes = data.saved.filter((f) => f.recipe).length;
  const foods = data.saved.filter((f) => !isSavedMeal(f) && !f.recipe).length;
  const perServing = items ? recipePerServing(items, servings) : null;
  const aiProvider = getDescriptionAiProvider();

  const unresolved =
    resolutions?.filter((r) => r.status === "needs-input") ?? [];

  async function work() {
    if (ingredients.trim() === "") return;

    setBusy(true);

    try {
      const res = await resolveSegments(ingredients, {
        saved: data?.saved ?? [],
      });
      setResolutions(res);

      const hasNeedsInput = res.some((r) => r.status === "needs-input");
      if (!hasNeedsInput) {
        setItems(res.map((r) => r.item!));
      } else {
        setItems(null);
      }
    } catch {
      setItems(null);
      showToast("Couldn't work that out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function openAddNumbers(idx: number) {
    tap();
    const item = resolutions?.[idx]?.item;
    setManualKcal(item?.calories ? String(item.calories) : "");
    setManualP(item?.protein ? String(item.protein) : "");
    setManualC(item?.carbs ? String(item.carbs) : "");
    setManualF(item?.fat ? String(item.fat) : "");
    setManualQty(item?.qty ?? "1 serving");
    setRememberChecked(true);
    setManualModalIndex(idx);
  }

  function applyManualNumbers() {
    if (manualModalIndex === null || !resolutions) return;
    tap();
    const idx = manualModalIndex;
    const current = resolutions[idx]!;
    const cal = Number(manualKcal) || 0;
    const p = Number(manualP) || 0;
    const c = Number(manualC) || 0;
    const f = Number(manualF) || 0;
    const qty = manualQty.trim() || current.item?.qty || "1 serving";

    const updatedItem: DraftItem = {
      ...(current.item ?? {
        name: current.segment,
        multiplier: 1,
      }),
      name: current.item?.name || current.segment,
      qty,
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      source: "manual",
      confidence: 0.95,
      multiplier: 1,
    };

    const nextResolutions = [...resolutions];
    nextResolutions[idx] = {
      ...current,
      status: "matched",
      item: updatedItem,
    };
    setResolutions(nextResolutions);

    if (rememberChecked) {
      void actions.rememberFood({
        name: updatedItem.name,
        qty: updatedItem.qty,
        calories: cal,
        protein: p,
        carbs: c,
        fat: f,
      });
      showToast(`Remembered ${updatedItem.name}`, "success");
    }

    const stillNeedsInput = nextResolutions.some(
      (r) => r.status === "needs-input",
    );
    if (!stillNeedsInput) {
      setItems(nextResolutions.map((r) => r.item!));
    }
    setManualModalIndex(null);
  }

  async function askAi(idx: number) {
    if (!resolutions || !aiProvider) return;
    tap();
    const row = resolutions[idx]!;
    setAiLoadingIndex(idx);

    try {
      const est = await aiProvider.estimate(row.segment);
      if (est.foods.length > 0 && !est.foods[0]!.unresolved) {
        const aiFood = est.foods[0]!;
        const updatedItem: DraftItem = {
          name: aiFood.name,
          qty: `${aiFood.estimatedAmount} ${aiFood.unit}`.trim(),
          calories: aiFood.calories,
          protein: aiFood.protein,
          carbs: aiFood.carbs,
          fat: aiFood.fat,
          confidence: 0.6,
          multiplier: 1,
          source: "ai",
        };
        const nextResolutions = [...resolutions];
        nextResolutions[idx] = {
          ...row,
          status: "estimated",
          item: updatedItem,
        };
        setResolutions(nextResolutions);

        const stillNeeds = nextResolutions.some(
          (r) => r.status === "needs-input",
        );
        if (!stillNeeds) {
          setItems(nextResolutions.map((r) => r.item!));
        }
        showToast(`AI estimated ${updatedItem.name}`, "success");
      } else {
        showToast("AI couldn't estimate that. Add numbers manually.");
      }
    } catch {
      showToast("AI request failed. Add numbers manually.");
    } finally {
      setAiLoadingIndex(null);
    }
  }

  async function save() {
    if (!items || name.trim() === "") return;

    const ok = await actions.addRecipe(name.trim(), items, servings);

    if (ok) {
      showToast("Recipe saved", "success");
      setName("");
      setIngredients("");
      setItems(null);
      setResolutions(null);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.tiles}>
        <Tile label="Meals" count={meals} onPress={() => setSavedOpen(true)} />
        <Tile label="Foods" count={foods} onPress={() => setSavedOpen(true)} />
        <Tile
          label="Recipes"
          count={recipes}
          onPress={() => setSavedOpen(true)}
        />
      </View>

      <NCard>
        <Label>New recipe</Label>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Rajma"
        />
        <Label>Servings</Label>
        <View style={s.servings}>
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <Pill
              key={n}
              label={String(n)}
              active={servings === n}
              onPress={() => setServings(n)}
            />
          ))}
        </View>
        <Label>Ingredients</Label>
        <TextInput
          value={ingredients}
          onChangeText={(text) => {
            setIngredients(text);
            setItems(null);
            setResolutions(null);
          }}
          multiline
          placeholder={
            "1 cup rajma, 2 onions, 1 tbsp oil\nList everything, including oil or ghee."
          }
          placeholderTextColor={N.dim}
          selectionColor={N.acc}
          style={s.area}
        />
        <Text style={[s.mute, s.gap]}>
          Ingredients are added up, then divided by servings. Cooking fat only
          counts if you list it.
        </Text>
        <Button
          label="Work it out"
          kind="ghost"
          onPress={() => void work()}
          busy={busy}
          disabled={ingredients.trim() === ""}
        />

        {/* Ingredient Review UI */}
        {resolutions && resolutions.length > 0 ? (
          <View style={s.reviewSection}>
            <Text style={s.sectionHeader}>
              Ingredients ({resolutions.length})
            </Text>

            {unresolved.length > 0 ? (
              <View style={s.unresolvedAlert}>
                <Text style={s.unresolvedAlertText}>
                  Unresolved: {unresolved.map((r) => r.item?.name || r.segment).join(", ")}. Add numbers below to save.
                </Text>
              </View>
            ) : null}

            {resolutions.map((res, idx) => {
              const item = res.item;
              const isNeedsInput = res.status === "needs-input";
              const isMatched = res.status === "matched";
              const isEstimated = res.status === "estimated";

              return (
                <View key={idx} style={s.ingredientRow}>
                  <View style={s.ingMain}>
                    <View style={s.ingTopLine}>
                      <Text style={s.ingName}>
                        {item?.name || res.segment}
                      </Text>
                      <View
                        style={[
                          s.statusChip,
                          isMatched && s.chipMatched,
                          isEstimated && s.chipEstimated,
                          isNeedsInput && s.chipNeedsInput,
                        ]}
                      >
                        <Text
                          style={[
                            s.statusText,
                            isMatched && s.statusTextMatched,
                            isEstimated && s.statusTextEstimated,
                            isNeedsInput && s.statusTextNeedsInput,
                          ]}
                        >
                          {isMatched
                            ? "Matched"
                            : isEstimated
                              ? "Estimated"
                              : "Needs input"}
                        </Text>
                      </View>
                    </View>

                    <Text style={s.ingQty}>{item?.qty ?? "1 serving"}</Text>

                    {!isNeedsInput ? (
                      <Text style={s.ingMacros}>
                        {Math.round(item?.calories ?? 0)} kcal · P{" "}
                        {Math.round(item?.protein ?? 0)} · C{" "}
                        {Math.round(item?.carbs ?? 0)} · F{" "}
                        {Math.round(item?.fat ?? 0)}
                      </Text>
                    ) : (
                      <Text style={s.ingReason}>
                        {res.reason || "Numbers needed"}
                      </Text>
                    )}

                    {isNeedsInput ? (
                      <View style={s.actionsRow}>
                        <Button
                          label="Add numbers"
                          kind="primary"
                          onPress={() => openAddNumbers(idx)}
                          style={s.actionBtn}
                        />
                        {aiProvider ? (
                          <Button
                            label="Ask AI"
                            kind="ghost"
                            onPress={() => void askAi(idx)}
                            busy={aiLoadingIndex === idx}
                            style={s.actionBtn}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {perServing ? (
          <View style={s.result}>
            <Text style={s.resultTitle}>Per serving</Text>
            <Text style={s.resultKcal}>{fmtInt(perServing.calories)} kcal</Text>
            <Text style={s.mute}>
              P {Math.round(perServing.protein)} · C{" "}
              {Math.round(perServing.carbs)} · F {Math.round(perServing.fat)}
            </Text>
            <View style={s.top}>
              <Button
                label="Save recipe"
                onPress={() => void save()}
                disabled={name.trim() === ""}
              />
              {name.trim() === "" ? (
                <Text style={s.mute}>Add a name to save.</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </NCard>

      {/* Manual Numbers Sheet */}
      <Sheet
        visible={manualModalIndex !== null}
        onClose={() => setManualModalIndex(null)}
        title={
          manualModalIndex !== null && resolutions?.[manualModalIndex]
            ? `Add numbers for ${resolutions[manualModalIndex]?.item?.name || resolutions[manualModalIndex]?.segment}`
            : "Add numbers"
        }
      >
        <View style={s.sheetContent}>
          <Field
            label="Portion / Amount"
            value={manualQty}
            onChangeText={setManualQty}
            placeholder="1 cup, 100g, 2 pieces"
          />
          <Field
            label="Calories (kcal)"
            value={manualKcal}
            onChangeText={setManualKcal}
            keyboardType="numeric"
            placeholder="e.g. 150"
          />
          <View style={s.macroRow}>
            <View style={s.macroCol}>
              <Field
                label="Protein (g)"
                value={manualP}
                onChangeText={setManualP}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={s.macroCol}>
              <Field
                label="Carbs (g)"
                value={manualC}
                onChangeText={setManualC}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={s.macroCol}>
              <Field
                label="Fat (g)"
                value={manualF}
                onChangeText={setManualF}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>

          <Pressable
            style={s.rememberRow}
            onPress={() => setRememberChecked(!rememberChecked)}
          >
            <Text style={s.rememberBox}>{rememberChecked ? "☑" : "☐"}</Text>
            <Text style={s.rememberText}>Remember this food for next time</Text>
          </Pressable>

          <Button
            label="Apply numbers"
            onPress={applyManualNumbers}
            disabled={manualKcal.trim() === ""}
          />
        </View>
      </Sheet>

      <SavedSheet
        visible={savedOpen}
        onClose={() => setSavedOpen(false)}
        foods={data.saved}
        onDelete={(food) => {
          void actions.removeSaved(food.id).then((ok) => {
            if (ok) {
              showUndoToast({
                message: `${food.name} removed`,
                onUndo: () => {
                  void actions.restoreSaved(food);
                },
              });
            }
          });
        }}
      />
    </ScrollView>
  );
}

function Tile({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <View style={s.tile}>
      <Pill label={`${label} · ${count}`} onPress={onPress} />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  mute: { color: N.mute, fontSize: 13, lineHeight: 18 },
  gap: { marginBottom: 12 },
  top: { marginTop: 12 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tile: {},
  servings: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  area: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    color: N.ink,
    fontSize: 15,
    minHeight: 110,
    padding: 14,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  reviewSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  sectionHeader: {
    color: N.mute,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  unresolvedAlert: {
    backgroundColor: "rgba(217, 164, 65, 0.12)",
    borderColor: N.warn,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  unresolvedAlertText: {
    color: N.warn,
    fontSize: 13,
    lineHeight: 18,
  },
  ingredientRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: N.line,
  },
  ingMain: { flex: 1 },
  ingTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ingName: { color: N.ink, fontSize: 15, fontWeight: "600" },
  ingQty: { color: N.mute, fontSize: 13, marginTop: 2 },
  ingMacros: { color: N.dim, fontSize: 13, marginTop: 2 },
  ingReason: { color: N.warn, fontSize: 13, marginTop: 2, fontStyle: "italic" },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipMatched: { backgroundColor: "rgba(76, 154, 106, 0.15)" },
  chipEstimated: { backgroundColor: "rgba(129, 169, 150, 0.15)" },
  chipNeedsInput: { backgroundColor: "rgba(217, 164, 65, 0.15)" },
  statusText: { fontSize: 11, fontWeight: "600" },
  statusTextMatched: { color: N.ok },
  statusTextEstimated: { color: N.acc },
  statusTextNeedsInput: { color: N.warn },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
  },
  result: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  resultTitle: {
    color: N.mute,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultKcal: { color: N.ink, fontSize: 28, marginVertical: 4 },
  sheetContent: {
    padding: 16,
    gap: 12,
  },
  macroRow: {
    flexDirection: "row",
    gap: 8,
  },
  macroCol: {
    flex: 1,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  rememberBox: {
    fontSize: 18,
    color: N.acc,
  },
  rememberText: {
    color: N.ink,
    fontSize: 14,
  },
});
