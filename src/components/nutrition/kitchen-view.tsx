import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { SavedSheet } from "@/components/nutrition/more-sheets";
import {
  Button,
  Field,
  Label,
  NCard,
  Pill,
  fmtInt,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import type { useNourish } from "@/hooks/use-nourish";
import { recipePerServing } from "@/services/nourish/diary";
import { resolveLogText } from "@/services/nourish/resolve-log";
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
  const [busy, setBusy] = useState(false);

  if (!data) return <Text style={s.mute}>Loading…</Text>;

  const meals = data.saved.filter(isSavedMeal).length;
  const recipes = data.saved.filter((f) => f.recipe).length;
  const foods = data.saved.filter((f) => !isSavedMeal(f) && !f.recipe).length;
  const perServing = items ? recipePerServing(items, servings) : null;

  async function work() {
    if (ingredients.trim() === "") return;

    setBusy(true);

    try {
      const outcome = await resolveLogText(ingredients, { saved: data?.saved ?? [] });

      if (outcome.status === "ready") {
        setItems(outcome.items);
      } else {
        setItems(null);
        showToast(
          "Couldn't price every ingredient. Use quantities, like \"1 cup rajma, 2 onions, 1 tbsp oil\".",
        );
      }
    } catch {
      setItems(null);
      showToast("Couldn't work that out. Try again.");
    } finally {
      setBusy(false);
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
    }
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.tiles}>
        <Tile label="Meals" count={meals} onPress={() => setSavedOpen(true)} />
        <Tile label="Foods" count={foods} onPress={() => setSavedOpen(true)} />
        <Tile label="Recipes" count={recipes} onPress={() => setSavedOpen(true)} />
      </View>

      <NCard>
        <Label>New recipe</Label>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Rajma" />
        <Label>Servings</Label>
        <View style={s.servings}>
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <Pill key={n} label={String(n)} active={servings === n} onPress={() => setServings(n)} />
          ))}
        </View>
        <Label>Ingredients</Label>
        <TextInput
          value={ingredients}
          onChangeText={(text) => {
            setIngredients(text);
            setItems(null);
          }}
          multiline
          placeholder={"1 cup rajma, 2 onions, 1 tbsp oil\nList everything, including oil or ghee."}
          placeholderTextColor={N.dim}
          selectionColor={N.acc}
          style={s.area}
        />
        <Text style={[s.mute, s.gap]}>
          Ingredients are added up, then divided by servings. Cooking fat only
          counts if you list it.
        </Text>
        <Button label="Work it out" kind="ghost" onPress={() => void work()} busy={busy} disabled={ingredients.trim() === ""} />

        {perServing ? (
          <View style={s.result}>
            <Text style={s.resultTitle}>Per serving</Text>
            <Text style={s.resultKcal}>{fmtInt(perServing.calories)} kcal</Text>
            <Text style={s.mute}>
              P {Math.round(perServing.protein)} · C {Math.round(perServing.carbs)} · F {Math.round(perServing.fat)}
            </Text>
            <View style={s.top}>
              <Button label="Save recipe" onPress={() => void save()} disabled={name.trim() === ""} />
              {name.trim() === "" ? <Text style={s.mute}>Add a name to save.</Text> : null}
            </View>
          </View>
        ) : null}
      </NCard>

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

function Tile({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
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
  servings: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
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
  result: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  resultTitle: { color: N.mute, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  resultKcal: { color: N.ink, fontSize: 28, marginVertical: 4 },
});
