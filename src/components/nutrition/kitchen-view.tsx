import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CountUp } from "@/components/ds/count-up";
import { Sheet } from "@/components/ds/sheet";
import {
  Button,
  Field,
  Label,
  Pill,
  Seg,
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
import {
  isSavedMeal,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { getTodayKey } from "@/utils/date";
import { showToast, showUndoToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;
type KitchenTab = "meals" | "foods" | "recipes";

const MEAL_SLOTS: readonly MealSlot[] = [
  "Breakfast",
  "Lunch",
  "Snacks",
  "Dinner",
];

function IngredientStatusChip({
  status,
}: {
  status: "needs-input" | "matched" | "estimated";
}) {
  const isNeedsInput = status === "needs-input";
  const isMatched = status === "matched";
  const isEstimated = status === "estimated";

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== status) {
      prevStatus.current = status;
      if (process.env.NODE_ENV === "test") return;
      fadeAnim.setValue(0.2);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [status, fadeAnim]);

  return (
    <Animated.View
      style={[
        s.statusChip,
        isMatched && s.chipMatched,
        isEstimated && s.chipEstimated,
        isNeedsInput && s.chipNeedsInput,
        { opacity: fadeAnim },
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
        {isMatched ? "Matched" : isEstimated ? "Estimated" : "Needs input"}
      </Text>
    </Animated.View>
  );
}

export function KitchenView({ nourish }: { nourish: Nourish }) {
  const { data, actions } = nourish;
  const [tab, setTab] = useState<KitchenTab>("meals");

  // Detail Sheet state
  const [detailFood, setDetailFood] = useState<SavedFood | null>(null);

  // Log Modal state
  const [logModalFood, setLogModalFood] = useState<SavedFood | null>(null);
  const [logSlot, setLogSlot] = useState<MealSlot>("Breakfast");
  const [logServingsMultiplier, setLogServingsMultiplier] = useState(1);
  const [customServingsText, setCustomServingsText] = useState("");

  // Builder Modals state
  const [newRecipeOpen, setNewRecipeOpen] = useState(false);
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [newFoodOpen, setNewFoodOpen] = useState(false);

  // New Recipe Builder state
  const [recipeName, setRecipeName] = useState("");
  const [recipeServings, setRecipeServings] = useState(1);
  const [recipeIngredients, setRecipeIngredients] = useState("");
  const [recipeItems, setRecipeItems] = useState<DraftItem[] | null>(null);
  const [recipeResolutions, setRecipeResolutions] = useState<
    SegmentResolution[] | null
  >(null);
  const [recipeBusy, setRecipeBusy] = useState(false);

  // Manual entry modal for unresolved ingredient in recipe
  const [manualModalIndex, setManualModalIndex] = useState<number | null>(null);
  const [manualKcal, setManualKcal] = useState("");
  const [manualP, setManualP] = useState("");
  const [manualC, setManualC] = useState("");
  const [manualF, setManualF] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [rememberChecked, setRememberChecked] = useState(true);
  const [aiLoadingIndex, setAiLoadingIndex] = useState<number | null>(null);

  // New Meal Builder state
  const [mealName, setMealName] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlot>("Breakfast");
  const [mealText, setMealText] = useState("");
  const [mealItems, setMealItems] = useState<DraftItem[]>([]);
  const [mealBusy, setMealBusy] = useState(false);

  // New Food Builder state
  const [foodName, setFoodName] = useState("");
  const [foodPortion, setFoodPortion] = useState("");
  const [foodKcal, setFoodKcal] = useState("");
  const [foodP, setFoodP] = useState("");
  const [foodC, setFoodC] = useState("");
  const [foodF, setFoodF] = useState("");

  if (!data) return <Text style={s.mute}>Loading…</Text>;

  const meals = data.saved.filter(isSavedMeal);
  const recipes = data.saved.filter((f) => f.recipe && !isSavedMeal(f));
  const foods = data.saved
    .filter((f) => !isSavedMeal(f) && !f.recipe)
    .sort(
      (a, b) =>
        (b.uses ?? 0) - (a.uses ?? 0) ||
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
    );

  const shown = tab === "meals" ? meals : tab === "recipes" ? recipes : foods;
  const aiProvider = getDescriptionAiProvider();

  // Recipe Per-serving
  const recipePerServ = recipeItems
    ? recipePerServing(recipeItems, recipeServings)
    : null;
  const unresolvedInRecipe =
    recipeResolutions?.filter((r) => r.status === "needs-input") ?? [];

  // -------------------------------------------------------------
  // Recipe Builder Handlers
  // -------------------------------------------------------------
  async function workRecipe() {
    if (recipeIngredients.trim() === "") return;
    setRecipeBusy(true);

    try {
      const res = await resolveSegments(recipeIngredients, {
        saved: data?.saved ?? [],
      });
      setRecipeResolutions(res);

      const hasNeedsInput = res.some((r) => r.status === "needs-input");
      if (!hasNeedsInput) {
        setRecipeItems(res.map((r) => r.item!));
      } else {
        setRecipeItems(null);
      }
    } catch {
      setRecipeItems(null);
      showToast("Couldn't work that out. Try again.");
    } finally {
      setRecipeBusy(false);
    }
  }

  function openAddNumbers(idx: number) {
    tap();
    const item = recipeResolutions?.[idx]?.item;
    setManualKcal(item?.calories ? String(item.calories) : "");
    setManualP(item?.protein ? String(item.protein) : "");
    setManualC(item?.carbs ? String(item.carbs) : "");
    setManualF(item?.fat ? String(item.fat) : "");
    setManualQty(item?.qty ?? "1 serving");
    setRememberChecked(true);
    setManualModalIndex(idx);
  }

  function applyManualNumbers() {
    if (manualModalIndex === null || !recipeResolutions) return;
    tap();
    const idx = manualModalIndex;
    const current = recipeResolutions[idx]!;
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

    const nextResolutions = [...recipeResolutions];
    nextResolutions[idx] = {
      ...current,
      status: "matched",
      item: updatedItem,
    };
    setRecipeResolutions(nextResolutions);

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
      setRecipeItems(nextResolutions.map((r) => r.item!));
    }
    setManualModalIndex(null);
  }

  async function askAi(idx: number) {
    if (!recipeResolutions || !aiProvider) return;
    tap();
    const row = recipeResolutions[idx]!;
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
        const nextResolutions = [...recipeResolutions];
        nextResolutions[idx] = {
          ...row,
          status: "estimated",
          item: updatedItem,
        };
        setRecipeResolutions(nextResolutions);

        const stillNeeds = nextResolutions.some(
          (r) => r.status === "needs-input",
        );
        if (!stillNeeds) {
          setRecipeItems(nextResolutions.map((r) => r.item!));
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

  async function saveRecipeAction() {
    if (!recipeItems || recipeName.trim() === "") return;

    const ok = await actions.addRecipe(
      recipeName.trim(),
      recipeItems,
      recipeServings,
    );
    if (ok) {
      showToast("Recipe saved to Kitchen › Recipes", "success");
      setRecipeName("");
      setRecipeIngredients("");
      setRecipeItems(null);
      setRecipeResolutions(null);
      setNewRecipeOpen(false);
    }
  }

  // -------------------------------------------------------------
  // Meal Builder Handlers
  // -------------------------------------------------------------
  async function resolveMealIngredients() {
    if (mealText.trim() === "") return;
    setMealBusy(true);

    try {
      const res = await resolveSegments(mealText, {
        saved: data?.saved ?? [],
      });
      const resolved = res.map((r) => r.item).filter(Boolean) as DraftItem[];
      setMealItems(resolved);
    } catch {
      showToast("Couldn't parse items.");
    } finally {
      setMealBusy(false);
    }
  }

  async function saveMealAction() {
    if (mealName.trim() === "" || mealItems.length === 0) return;

    const foods = mealItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      calories: Math.round(item.calories * item.multiplier),
      protein: Math.round(item.protein * item.multiplier * 10) / 10,
      carbs: Math.round(item.carbs * item.multiplier * 10) / 10,
      fat: Math.round(item.fat * item.multiplier * 10) / 10,
    }));

    const totals = {
      calories: foods.reduce((sum, f) => sum + f.calories, 0),
      protein: foods.reduce((sum, f) => sum + f.protein, 0),
      carbs: foods.reduce((sum, f) => sum + f.carbs, 0),
      fat: foods.reduce((sum, f) => sum + f.fat, 0),
    };

    const ok = await actions.createSavedFood(mealName.trim(), totals, foods, {
      slot: mealSlot,
    });
    if (ok) {
      showToast("Meal saved to Kitchen › Meals", "success");
      setMealName("");
      setMealText("");
      setMealItems([]);
      setNewMealOpen(false);
    }
  }

  // -------------------------------------------------------------
  // Food Builder Handlers
  // -------------------------------------------------------------
  async function saveFoodAction() {
    if (foodName.trim() === "") return;

    const ok = await actions.createSavedFood(
      foodName.trim(),
      {
        calories: Number(foodKcal) || 0,
        protein: Number(foodP) || 0,
        carbs: Number(foodC) || 0,
        fat: Number(foodF) || 0,
      },
      undefined,
      { qty: foodPortion.trim() || "1 serving" },
    );

    if (ok) {
      showToast("Food saved to Kitchen › Foods", "success");
      setFoodName("");
      setFoodPortion("");
      setFoodKcal("");
      setFoodP("");
      setFoodC("");
      setFoodF("");
      setNewFoodOpen(false);
    }
  }

  // -------------------------------------------------------------
  // Log from Kitchen Handlers
  // -------------------------------------------------------------
  function openLogModal(food: SavedFood) {
    tap();
    setLogModalFood(food);
    setLogSlot(food.slot ?? "Breakfast");
    setLogServingsMultiplier(1);
    setCustomServingsText("");
  }

  async function executeLog() {
    if (!logModalFood) return;
    tap();
    const multiplier = customServingsText
      ? Number(customServingsText) || 1
      : logServingsMultiplier;

    const ok = await actions.logSaved(logModalFood, getTodayKey(), {
      slot: logSlot,
      servingsMultiplier: multiplier,
    });

    if (ok) {
      showToast(`Logged to ${logSlot}`, "success");
      setLogModalFood(null);
    }
  }

  function deleteSavedItem(food: SavedFood) {
    tap();
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
    setDetailFood(null);
  }

  function startEditRecipe(recipe: SavedFood) {
    tap();
    setDetailFood(null);
    setRecipeName(recipe.name);
    setRecipeServings(recipe.servings ?? 1);
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      setRecipeItems(recipe.ingredients);
      setRecipeIngredients(
        recipe.ingredients.map((i) => `${i.qty} ${i.name}`).join("\n"),
      );
    } else {
      setRecipeIngredients("");
      setRecipeItems(null);
    }
    setNewRecipeOpen(true);
  }

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Explainer */}
      <View style={s.explainerCard}>
        <Text style={s.explainerText}>
          <Text style={s.bold}>Food:</Text> one item with your portion.{" "}
          <Text style={s.bold}>Meal:</Text> foods logged together.{" "}
          <Text style={s.bold}>Recipe:</Text> ingredients divided into
          servings.
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.segWrap}>
        <Seg
          value={tab}
          onChange={(next) => {
            tap();
            setTab(next as KitchenTab);
          }}
          options={[
            { value: "meals", label: `Meals (${meals.length})` },
            { value: "foods", label: `Foods (${foods.length})` },
            { value: "recipes", label: `Recipes (${recipes.length})` },
          ]}
        />
      </View>

      {/* Tab Action Button */}
      <View style={s.tabTopBar}>
        {tab === "meals" ? (
          <Button
            label="+ New Meal"
            onPress={() => {
              tap();
              setNewMealOpen(true);
            }}
          />
        ) : tab === "foods" ? (
          <Button
            label="+ New Food"
            onPress={() => {
              tap();
              setNewFoodOpen(true);
            }}
          />
        ) : (
          <Button
            label="+ New Recipe"
            onPress={() => {
              tap();
              setNewRecipeOpen(true);
            }}
          />
        )}
      </View>

      {/* List Rows */}
      {shown.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>
            {tab === "meals"
              ? "Build a meal here, or log food in Today and tap Save meal."
              : tab === "foods"
                ? "Foods you confirm show up here."
                : "Build a recipe from ingredients; it divides into servings."}
          </Text>
        </View>
      ) : (
        <View style={s.listContainer}>
          {shown.map((item) => {
            const isMeal = isSavedMeal(item);
            const isRec = item.recipe;

            const subText = isMeal
              ? `${Math.round(item.calories ?? 0)} kcal · P ${Math.round(item.protein ?? 0)} · ${item.foods?.length ?? 0} items`
              : isRec
                ? `${Math.round(item.calories ?? 0)} kcal / serving · P ${Math.round(item.protein ?? 0)}${item.servings ? ` · ${item.servings} servings` : ""}`
                : `${Math.round(item.calories ?? 0)} kcal · P ${Math.round(item.protein ?? 0)}${item.qty ? ` · ${item.qty}` : ""}`;

            return (
              <View key={item.id} style={s.listRow}>
                <Pressable
                  style={s.rowMain}
                  onPress={() => {
                    tap();
                    setDetailFood(item);
                  }}
                >
                  <Text style={s.rowName}>{item.name}</Text>
                  <Text style={s.rowSub}>{subText}</Text>
                </Pressable>

                <View style={s.rowActions}>
                  <Button
                    label="Log"
                    kind="primary"
                    onPress={() => openLogModal(item)}
                    style={s.logBtn}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Detail Sheet */}
      <Sheet
        visible={detailFood !== null}
        onClose={() => setDetailFood(null)}
        title={detailFood?.name ?? "Details"}
      >
        {detailFood ? (
          <View style={s.detailSheetContent}>
            <View style={s.detailMacros}>
              <Text style={s.detailKcal}>
                {Math.round(detailFood.calories ?? 0)} kcal
              </Text>
              <Text style={s.detailSubMacros}>
                P {Math.round(detailFood.protein ?? 0)}g · C{" "}
                {Math.round(detailFood.carbs ?? 0)}g · F{" "}
                {Math.round(detailFood.fat ?? 0)}g
              </Text>
              {detailFood.qty ? (
                <Text style={s.mute}>Portion: {detailFood.qty}</Text>
              ) : null}
            </View>

            {detailFood.recipe ? (
              <View style={s.breakdownSection}>
                <Text style={s.breakdownTitle}>Recipe Ingredients</Text>
                {detailFood.ingredients &&
                detailFood.ingredients.length > 0 ? (
                  detailFood.ingredients.map((ing, idx) => (
                    <View key={idx} style={s.ingItem}>
                      <Text style={s.ingItemName}>{ing.name}</Text>
                      <Text style={s.ingItemQty}>{ing.qty}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.warnText}>
                    Ingredients weren&apos;t saved for this recipe
                  </Text>
                )}
                <View style={s.top}>
                  <Button
                    label={
                      detailFood.ingredients?.length
                        ? "Edit recipe"
                        : "Edit by rebuilding"
                    }
                    kind="ghost"
                    onPress={() => startEditRecipe(detailFood)}
                  />
                </View>
              </View>
            ) : isSavedMeal(detailFood) ? (
              <View style={s.breakdownSection}>
                <Text style={s.breakdownTitle}>Meal Foods</Text>
                {detailFood.foods?.map((f, idx) => (
                  <View key={idx} style={s.ingItem}>
                    <Text style={s.ingItemName}>{f.name}</Text>
                    <Text style={s.ingItemQty}>
                      {f.qty ?? `${Math.round(f.calories)} kcal`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={s.detailFooter}>
              <Button
                label="Delete"
                kind="danger"
                onPress={() => deleteSavedItem(detailFood)}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* Log Modal */}
      <Sheet
        visible={logModalFood !== null}
        onClose={() => setLogModalFood(null)}
        title={logModalFood ? `Log ${logModalFood.name}` : "Log"}
      >
        {logModalFood ? (
          <View style={s.logModalContent}>
            <Label>Target Slot</Label>
            <View style={s.slotPills}>
              {MEAL_SLOTS.map((slot) => (
                <Pill
                  key={slot}
                  label={slot}
                  active={logSlot === slot}
                  onPress={() => setLogSlot(slot)}
                />
              ))}
            </View>

            {logModalFood.recipe ? (
              <>
                <Label>Servings</Label>
                <View style={s.servingsRow}>
                  {[0.5, 1, 1.5, 2].map((num) => (
                    <Pill
                      key={num}
                      label={
                        num === 0.5
                          ? "½"
                          : num === 1.5
                            ? "1½"
                            : String(num)
                      }
                      active={
                        !customServingsText && logServingsMultiplier === num
                      }
                      onPress={() => {
                        setLogServingsMultiplier(num);
                        setCustomServingsText("");
                      }}
                    />
                  ))}
                </View>
                <Field
                  label="Custom servings"
                  value={customServingsText}
                  onChangeText={setCustomServingsText}
                  keyboardType="numeric"
                  placeholder="e.g. 2.5"
                />
              </>
            ) : null}

            {/* Scaled Preview */}
            <View style={s.logPreview}>
              {(() => {
                const mult = customServingsText
                  ? Number(customServingsText) || 1
                  : logServingsMultiplier;
                const cal = Math.round((logModalFood.calories ?? 0) * mult);
                const p =
                  Math.round((logModalFood.protein ?? 0) * mult * 10) / 10;
                const c =
                  Math.round((logModalFood.carbs ?? 0) * mult * 10) / 10;
                const f =
                  Math.round((logModalFood.fat ?? 0) * mult * 10) / 10;

                return (
                  <>
                    <Text style={s.logPreviewKcal}>{cal} kcal</Text>
                    <Text style={s.mute}>
                      P {p}g · C {c}g · F {f}g
                    </Text>
                  </>
                );
              })()}
            </View>

            <Button label={`Log into ${logSlot}`} onPress={executeLog} />
          </View>
        ) : null}
      </Sheet>

      {/* New Recipe Builder Modal */}
      <Sheet
        visible={newRecipeOpen}
        onClose={() => setNewRecipeOpen(false)}
        title="New Recipe"
      >
        <ScrollView style={s.sheetScroll} keyboardShouldPersistTaps="handled">
          <Field
            label="Recipe Name"
            value={recipeName}
            onChangeText={setRecipeName}
            placeholder="e.g. Rajma Masala"
          />
          <Label>Servings</Label>
          <View style={s.servingsRow}>
            {[1, 2, 3, 4, 6].map((n) => (
              <Pill
                key={n}
                label={String(n)}
                active={recipeServings === n}
                onPress={() => setRecipeServings(n)}
              />
            ))}
          </View>

          <Label>Ingredients</Label>
          <TextInput
            value={recipeIngredients}
            onChangeText={(text) => {
              setRecipeIngredients(text);
              setRecipeItems(null);
              setRecipeResolutions(null);
            }}
            multiline
            placeholder={
              "1 cup rajma\n2 onions\n1 tbsp oil\nList everything, including oil or ghee."
            }
            placeholderTextColor={N.dim}
            selectionColor={N.acc}
            style={s.area}
          />

          <Button
            label="Work it out"
            kind="ghost"
            onPress={() => void workRecipe()}
            busy={recipeBusy}
            disabled={recipeIngredients.trim() === ""}
          />

          {/* Ingredient Review UI */}
          {recipeResolutions && recipeResolutions.length > 0 ? (
            <View style={s.reviewSection}>
              <Text style={s.sectionHeader}>
                Ingredients ({recipeResolutions.length})
              </Text>

              {unresolvedInRecipe.length > 0 ? (
                <View style={s.unresolvedAlert}>
                  <Text style={s.unresolvedAlertText}>
                    Unresolved:{" "}
                    {unresolvedInRecipe
                      .map((r) => r.item?.name || r.segment)
                      .join(", ")}
                    . Add numbers below to save.
                  </Text>
                </View>
              ) : null}

              {recipeResolutions.map((res, idx) => {
                const item = res.item;
                const isNeedsInput = res.status === "needs-input";

                return (
                  <View key={idx} style={s.ingredientRow}>
                    <View style={s.ingMain}>
                      <View style={s.ingTopLine}>
                        <Text style={s.ingName}>
                          {item?.name || res.segment}
                        </Text>
                        <IngredientStatusChip status={res.status} />
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

          {/* Per Serving Panel */}
          {recipePerServ ? (
            <View style={s.result}>
              <Text style={s.resultTitle}>Per serving</Text>
              <Text style={s.resultKcal}>
                <CountUp value={Math.round(recipePerServ.calories)} /> kcal
              </Text>
              <Text style={s.mute}>
                P <CountUp value={Math.round(recipePerServ.protein)} /> · C{" "}
                <CountUp value={Math.round(recipePerServ.carbs)} /> · F{" "}
                <CountUp value={Math.round(recipePerServ.fat)} />
              </Text>
              <View style={s.top}>
                <Button
                  label="Save recipe"
                  onPress={() => void saveRecipeAction()}
                  disabled={recipeName.trim() === ""}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </Sheet>

      {/* Manual Numbers Sheet for Recipe Ingredient */}
      <Sheet
        visible={manualModalIndex !== null}
        onClose={() => setManualModalIndex(null)}
        title="Add numbers"
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

      {/* New Meal Builder Modal */}
      <Sheet
        visible={newMealOpen}
        onClose={() => setNewMealOpen(false)}
        title="New Meal"
      >
        <ScrollView style={s.sheetScroll} keyboardShouldPersistTaps="handled">
          <Field
            label="Meal Name"
            value={mealName}
            onChangeText={setMealName}
            placeholder="e.g. Usual Breakfast"
          />
          <Label>Slot</Label>
          <View style={s.slotPills}>
            {MEAL_SLOTS.map((slot) => (
              <Pill
                key={slot}
                label={slot}
                active={mealSlot === slot}
                onPress={() => setMealSlot(slot)}
              />
            ))}
          </View>
          <Label>Items in this meal</Label>
          <TextInput
            value={mealText}
            onChangeText={setMealText}
            multiline
            placeholder="2 rotis, 1 bowl dal, 1 spoon ghee"
            placeholderTextColor={N.dim}
            selectionColor={N.acc}
            style={s.area}
          />
          <Button
            label="Parse items"
            kind="ghost"
            onPress={() => void resolveMealIngredients()}
            busy={mealBusy}
            disabled={mealText.trim() === ""}
          />

          {mealItems.length > 0 ? (
            <View style={s.reviewSection}>
              <Text style={s.sectionHeader}>Items ({mealItems.length})</Text>
              {mealItems.map((item, idx) => (
                <View key={idx} style={s.ingItem}>
                  <Text style={s.ingItemName}>{item.name}</Text>
                  <Text style={s.ingItemQty}>
                    {item.qty} · {Math.round(item.calories)} kcal
                  </Text>
                </View>
              ))}

              <View style={s.result}>
                <Text style={s.resultTitle}>Meal Totals</Text>
                <Text style={s.resultKcal}>
                  <CountUp value={mealItems.reduce((sum, i) => sum + i.calories, 0)} /> kcal
                </Text>
                <Text style={s.mute}>
                  P{" "}
                  <CountUp
                    value={Math.round(
                      mealItems.reduce((sum, i) => sum + i.protein, 0),
                    )}
                  />
                  g · C{" "}
                  <CountUp
                    value={Math.round(mealItems.reduce((sum, i) => sum + i.carbs, 0))}
                  />
                  g · F{" "}
                  <CountUp
                    value={Math.round(mealItems.reduce((sum, i) => sum + i.fat, 0))}
                  />
                  g
                </Text>
              </View>

              <View style={s.top}>
                <Button
                  label="Save meal"
                  onPress={() => void saveMealAction()}
                  disabled={mealName.trim() === ""}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </Sheet>

      {/* New Food Modal */}
      <Sheet
        visible={newFoodOpen}
        onClose={() => setNewFoodOpen(false)}
        title="New Food"
      >
        <View style={s.sheetContent}>
          <Field
            label="Food Name"
            value={foodName}
            onChangeText={setFoodName}
            placeholder="e.g. Greek yogurt"
          />
          <Field
            label="Portion Text"
            value={foodPortion}
            onChangeText={setFoodPortion}
            placeholder="e.g. 1 cup, 100g, 2 pieces"
          />
          <Field
            label="Calories (kcal)"
            value={foodKcal}
            onChangeText={setFoodKcal}
            keyboardType="numeric"
            placeholder="e.g. 120"
          />
          <View style={s.macroRow}>
            <View style={s.macroCol}>
              <Field
                label="Protein (g)"
                value={foodP}
                onChangeText={setFoodP}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={s.macroCol}>
              <Field
                label="Carbs (g)"
                value={foodC}
                onChangeText={setFoodC}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={s.macroCol}>
              <Field
                label="Fat (g)"
                value={foodF}
                onChangeText={setFoodF}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>
          <Button
            label="Save food"
            onPress={() => void saveFoodAction()}
            disabled={foodName.trim() === "" || foodKcal.trim() === ""}
          />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 0, paddingVertical: 8, paddingBottom: 40 },
  explainerCard: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 12,
    marginBottom: 12,
  },
  explainerText: {
    color: N.mute,
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    color: N.ink,
    fontWeight: "600",
  },
  segWrap: { marginBottom: 12 },
  tabTopBar: {
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emptyText: {
    color: N.dim,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  listContainer: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: N.line,
  },
  rowMain: { flex: 1 },
  rowName: { color: N.ink, fontSize: 16, fontWeight: "600" },
  rowSub: { color: N.mute, fontSize: 13, marginTop: 3 },
  rowActions: {
    marginLeft: 12,
  },
  logBtn: {
    paddingHorizontal: 14,
  },
  mute: { color: N.mute, fontSize: 13, lineHeight: 18 },
  top: { marginTop: 12 },
  area: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    color: N.ink,
    fontSize: 15,
    minHeight: 100,
    padding: 12,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  reviewSection: {
    marginTop: 14,
    paddingTop: 14,
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
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  resultTitle: {
    color: N.mute,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultKcal: { color: N.ink, fontSize: 26, marginVertical: 4 },
  sheetContent: {
    padding: 16,
    gap: 12,
  },
  sheetScroll: {
    maxHeight: 520,
    padding: 16,
  },
  servingsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  slotPills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
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
  detailSheetContent: {
    padding: 16,
    gap: 14,
  },
  detailMacros: {
    alignItems: "center",
    paddingVertical: 8,
  },
  detailKcal: {
    color: N.ink,
    fontSize: 28,
    fontWeight: "700",
  },
  detailSubMacros: {
    color: N.acc,
    fontSize: 14,
    marginVertical: 4,
  },
  breakdownSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: N.line,
    paddingTop: 12,
  },
  breakdownTitle: {
    color: N.mute,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  ingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: N.line,
  },
  ingItemName: {
    color: N.ink,
    fontSize: 14,
  },
  ingItemQty: {
    color: N.mute,
    fontSize: 13,
  },
  warnText: {
    color: N.warn,
    fontSize: 13,
    fontStyle: "italic",
    marginVertical: 6,
  },
  detailFooter: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: N.line,
    paddingTop: 12,
  },
  logModalContent: {
    padding: 16,
    gap: 12,
  },
  logPreview: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    padding: 12,
    alignItems: "center",
    marginVertical: 8,
  },
  logPreviewKcal: {
    color: N.ink,
    fontSize: 22,
    fontWeight: "600",
  },
});
