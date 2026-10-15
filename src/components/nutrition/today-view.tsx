import * as Haptics from "expo-haptics";
import {
  Bookmark,
  BookmarkPlus,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Utensils,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditEntrySheet,
  ManualSheet,
  ReviewSheet,
} from "@/components/nutrition/log-sheets";
import {
  CardioSheet,
  DayPickerSheet,
  MicrosSheet,
  SavedSheet,
  SuggestionsSheet,
} from "@/components/nutrition/more-sheets";
import { CardioSection, DateNavigator } from "@/components/ds";
import { SummaryCard } from "@/components/nutrition/summary-card";
import { computeSummaryCardViewModel } from "@/components/nutrition/summary-card-view-model";
import {
  Bar,
  Button,
  Field,
  NCard,
  Pill,
  Ring,
  Sheet,
  fmtInt,
  tap,
} from "@/components/nutrition/nourish-ui";
import { N, NRadius, NSerif } from "@/constants/nourish-theme";
import { useFoodLogger } from "@/hooks/use-food-logger";
import type { useNourish } from "@/hooks/use-nourish";
import { useTodayKey } from "@/hooks/use-today-key";
import { dayTitle, FEEL_OPTIONS } from "@/services/nourish/format";
import { confidenceLabel, confidenceOf } from "@/services/nourish/nutrition";
import { slotOfMeal, timeOfDay } from "@/services/nourish/slots";
import { savedFoodToDraft } from "@/services/nourish/resolve-log";
import { normalizeFoodName } from "@/services/food-db";
import {
  catalogCandidates,
  suggestProteinOptions,
  type Suggestion,
  type SuggestionCandidate,
} from "@/services/nourish/suggestions";
import {
  groupIntoOccasions,
  type EatingOccasion,
} from "@/services/nourish/timeline-occasions";
import {
  getOccasionTitles,
  setOccasionTitle,
  type OccasionTitlesMap,
} from "@/storage/repositories/occasion-titles";
import {
  extractFoodUnit,
  isItemSaved,
  isSavedMeal,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { Meal, MealSlot } from "@/types/gymos";
import { pickMicronutrients } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import {
  addDaysToKey,
  dateKeyFromTimestamp,
  getTodayKey,
} from "@/utils/date";
import { showToast, showUndoToast } from "@/utils/toast";

type Nourish = ReturnType<typeof useNourish>;

export function TodayView({ nourish }: { nourish: Nourish }) {
  const { data, model, actions, records, weightKg } = nourish;
  const todayKey = useTodayKey();
  // null follows "today" (so it rolls over at midnight); a string is a past
  // day the user deliberately navigated to and stays put.
  const [picked, setPicked] = useState<string | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const dayKey = picked ?? todayKey;
  const [input, setInput] = useState("");
  const [cardioText, setCardioText] = useState<string | null>(null);
  const [microsOpen, setMicrosOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [occasionTitles, setOccasionTitles] = useState<OccasionTitlesMap>({});
  const [renamingOccasion, setRenamingOccasion] = useState<EatingOccasion | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [savingMealOccasion, setSavingMealOccasion] = useState<EatingOccasion | null>(null);
  const [saveMealName, setSaveMealName] = useState("");
  const [saveMealBusy, setSaveMealBusy] = useState(false);
  const [expandedFeelKeys, setExpandedFeelKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    void getOccasionTitles().then((titles) => {
      if (active && Object.keys(titles).length > 0) {
        setOccasionTitles(titles);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const insets = useSafeAreaInsets();
  const BASE_DOCK_BOTTOM = 12 + (insets.bottom || 0);

  const dockBottomAnim = useRef(new Animated.Value(BASE_DOCK_BOTTOM)).current;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  const currentKeyboardHeight = useRef(0);
  const initialLayoutHeight = useRef(0);
  const currentLayoutHeight = useRef(0);
  const [dockHeight, setDockHeight] = useState(56);

  const updateDockPosition = useCallback(
    (kbHeight: number, duration: number) => {
      if (kbHeight <= 0) {
        keyboardOpenRef.current = false;
        setKeyboardOpen(false);
        Animated.timing(dockBottomAnim, {
          toValue: BASE_DOCK_BOTTOM,
          duration: duration || 200,
          useNativeDriver: false,
        }).start();
        return;
      }

      keyboardOpenRef.current = true;
      setKeyboardOpen(true);
      currentKeyboardHeight.current = kbHeight;

      // How much the container layout already shrank (e.g. adjustResize / window resize)
      const layoutReserved = Math.max(
        0,
        (initialLayoutHeight.current || 0) - (currentLayoutHeight.current || 0),
      );

      // Remaining distance from container bottom to keyboard top
      const uncompensated = Math.max(0, kbHeight - layoutReserved);

      // Dock bottom edge sits directly on keyboard top with an 8dp gap max (like WhatsApp).
      // If layout already resized (uncompensated === 0), sits at 8dp from container bottom.
      const targetBottom = uncompensated + 8;

      Animated.timing(dockBottomAnim, {
        toValue: targetBottom,
        duration: duration || 200,
        useNativeDriver: false,
      }).start();
    },
    [BASE_DOCK_BOTTOM, dockBottomAnim],
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const frameEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidChangeFrame";

    const handleShow = (e: any) => {
      const h = e.endCoordinates?.height || 0;
      updateDockPosition(h, e.duration || 180);
    };

    const handleHide = (e: any) => {
      updateDockPosition(0, e?.duration || 180);
    };

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);
    const frameSub = Keyboard.addListener(frameEvent, handleShow);

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub.remove();
    };
  }, [updateDockPosition]);

  const day = model(dayKey);
  const prevKey = addDaysToKey(dayKey, -1);
  const prevMeals = records?.get(prevKey)?.meals ?? [];

  const prevCaloriesRef = useRef<number | null>(null);

  useEffect(() => {
    if (!day || process.env.NODE_ENV === "test") return;
    const currentKcal = day.totals.calories;
    const budget = day.budget;

    if (
      prevCaloriesRef.current !== null &&
      budget > 0 &&
      prevCaloriesRef.current < budget &&
      currentKcal >= budget
    ) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevCaloriesRef.current = currentKcal;
  }, [day]);

  const filled = useMemo(
    () =>
      new Set<MealSlot>(
        (day?.meals ?? []).map((meal) => slotOfMeal(meal)),
      ),
    [day],
  );

  const occasions = useMemo(
    () => groupIntoOccasions(day?.meals ?? [], occasionTitles, day?.feel),
    [day?.meals, occasionTitles, day?.feel],
  );

  const handleSaveOccasionTitle = useCallback(
    async (newTitle: string) => {
      if (!renamingOccasion) return;
      const id = renamingOccasion.id;
      await setOccasionTitle(id, newTitle);
      setOccasionTitles((prev) => {
        const next = { ...prev };
        if (!newTitle.trim()) {
          delete next[id];
        } else {
          next[id] = newTitle.trim();
        }
        return next;
      });
      setRenamingOccasion(null);
    },
    [renamingOccasion],
  );

  const loggedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!records) return keys;
    for (const [k, r] of records.entries()) {
      if ((r.meals?.length ?? 0) > 0) {
        keys.add(k);
      }
    }
    return keys;
  }, [records]);

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

  const { totals, targets } = day;
  const allowance = day.budget - data.settings.kcal;
  const uncertainty = Math.round(totals.uncertainty / 10) * 10;
  const over = day.remaining < 0;

  const summaryVm = computeSummaryCardViewModel({
    eatenKcal: totals.calories,
    budgetKcal: day.budget,
    burnedKcal: day.burnKcal,
    uncertainty: uncertainty > 0 ? uncertainty : undefined,
    macrosEaten: {
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    },
    macroTargets: {
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
    },
  });

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

  async function handleBookmarkMeal(meal: Meal) {
    tap();
    const targetName = normalizeFoodName(meal.name);
    const targetUnit = extractFoodUnit(meal.qty);
    const existingSaved = data?.saved?.find(
      (saved) =>
        !isSavedMeal(saved) &&
        !saved.recipe &&
        normalizeFoodName(saved.name) === targetName &&
        extractFoodUnit(saved.qty) === targetUnit,
    );

    if (existingSaved) {
      const macrosDiffer =
        Math.round(existingSaved.calories ?? 0) !== Math.round(meal.calories ?? 0) ||
        Math.round(existingSaved.protein ?? 0) !== Math.round(meal.protein ?? 0) ||
        Math.round(existingSaved.carbs ?? 0) !== Math.round(meal.carbs ?? 0) ||
        Math.round(existingSaved.fat ?? 0) !== Math.round(meal.fat ?? 0);

      const doRemove = async () => {
        await actions.removeSaved(existingSaved.id);
        showUndoToast({
          message: `Removed ${meal.name} from Saved foods`,
          onUndo: async () => {
            await actions.restoreSaved(existingSaved);
          },
        });
      };

      if (macrosDiffer) {
        Alert.alert(
          "Update saved food?",
          `Logged macros (${Math.round(meal.calories ?? 0)} kcal, ${Math.round(meal.protein ?? 0)}g protein) differ from your saved food (${Math.round(existingSaved.calories ?? 0)} kcal, ${Math.round(existingSaved.protein ?? 0)}g protein).`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove from Saved",
              style: "destructive",
              onPress: () => void doRemove(),
            },
            {
              text: "Update Saved Food",
              onPress: async () => {
                const updated = await actions.updateSavedFood(existingSaved.id, {
                  calories: meal.calories ?? 0,
                  protein: meal.protein ?? 0,
                  carbs: meal.carbs ?? 0,
                  fat: meal.fat ?? 0,
                  ...pickMicronutrients(meal),
                  qty: meal.qty,
                });
                if (updated) {
                  showToast(`Updated ${meal.name} in Saved foods`, "success");
                }
              },
            },
          ],
        );
        return;
      }

      await doRemove();
      return;
    }

    const ok = await actions.createSavedFood(
      meal.name,
      {
        calories: meal.calories ?? 0,
        protein: meal.protein ?? 0,
        carbs: meal.carbs ?? 0,
        fat: meal.fat ?? 0,
        ...pickMicronutrients(meal),
      },
      undefined,
      { qty: meal.qty },
    );
    if (ok) {
      showUndoToast({
        message: `Saved ${meal.name} to Saved foods`,
        onUndo: async () => {
          const currentSaved = data?.saved ?? [];
          const added = currentSaved.find(
            (s) =>
              !isSavedMeal(s) &&
              !s.recipe &&
              normalizeFoodName(s.name) === targetName &&
              extractFoodUnit(s.qty) === targetUnit,
          );
          if (added) {
            await actions.removeSaved(added.id);
          }
        },
      });
    }
  }

  async function handleSaveMeal() {
    if (!savingMealOccasion || !saveMealName.trim() || saveMealBusy) return;
    setSaveMealBusy(true);
    try {
      const saved = await actions.saveMealWithItems(
        saveMealName.trim(),
        savingMealOccasion.meals,
        savingMealOccasion.slot,
      );
      if (saved) {
        showToast("Saved to Kitchen › Meals", "success");
        setSavingMealOccasion(null);
      }
    } catch {
      showToast("Couldn't save meal");
    } finally {
      setSaveMealBusy(false);
    }
  }

  return (
    <View
      style={s.fill}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) {
          if (
            initialLayoutHeight.current === 0 ||
            (!keyboardOpenRef.current && h > initialLayoutHeight.current)
          ) {
            initialLayoutHeight.current = h;
          }
          currentLayoutHeight.current = h;
          if (keyboardOpenRef.current && currentKeyboardHeight.current > 0) {
            updateDockPosition(currentKeyboardHeight.current, 150);
          }
        }
      }}
    >
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingBottom:
              (keyboardOpen ? 8 : BASE_DOCK_BOTTOM) + dockHeight + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <DateNavigator
          dateKey={dayKey}
          todayKey={todayKey}
          onStep={stepDay}
          onOpenCalendar={() => setDayPickerOpen(true)}
          onBackToToday={() => setPicked(null)}
          accentColor={N.acc}
        />

        <SummaryCard
          vm={summaryVm}
          onOpenMicros={() => setMicrosOpen(true)}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          {prevMeals.length > 0 ? (
            <Pill
              label={`Repeat ${dayTitle(prevKey, todayKey).toLowerCase()}`}
              icon={<RotateCcw size={14} color={N.mute} />}
              onPress={repeatPrevious}
            />
          ) : null}
          <Pill
            label="Saved"
            icon={<Bookmark size={14} color={N.mute} />}
            onPress={() => setSavedOpen(true)}
          />
          <Pill
            label="Add food"
            accessibilityLabel="Add manually"
            icon={<Plus size={14} color={N.mute} />}
            onPress={() => logger.openManual()}
          />
          <Pill
            label="Eating out"
            icon={<Utensils size={14} color={logger.eatingOut ? N.accInk : N.mute} />}
            active={logger.eatingOut}
            onPress={() => logger.setEatingOut(!logger.eatingOut)}
          />
          {day.proteinGap > 0 && day.meals.length > 0 ? (
            <Pill
              label={`${Math.round(day.proteinGap)}g protein to go`}
              icon={<Sparkles size={14} color={N.mute} />}
              onPress={() => setIdeasOpen(true)}
            />
          ) : null}
        </ScrollView>

        {occasions.map((occasion) => {
          const { meals: entries, totals: occasionTotals, slot, title, id } = occasion;

          return (
            <View key={id} style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionTitleRow}>
                  <View style={s.sectionTitleWrap}>
                    <Text style={s.sectionTitle}>{title}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${title}`}
                      hitSlop={8}
                      onPress={() => {
                        tap();
                        setRenamingOccasion(occasion);
                        setRenameInput(title);
                      }}
                      style={s.renameBtn}
                    >
                      <Pencil size={13} color={N.mute} />
                    </Pressable>
                  </View>
                  <View style={s.sectionRightWrap}>
                    <Text style={s.sectionSub}>
                      {fmtInt(occasionTotals.calories)} kcal · {Math.round(occasionTotals.protein)}g protein
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${title} as meal`}
                      hitSlop={10}
                      onPress={() => {
                        tap();
                        setSavingMealOccasion(occasion);
                        setSaveMealName(title);
                      }}
                      style={s.saveMealHeaderBtn}
                    >
                      <BookmarkPlus size={16} color={N.acc} />
                    </Pressable>
                  </View>
                </View>
              </View>
              <NCard style={s.rows}>
                {entries.map((meal, index) => (
                  <EntryRow
                    key={meal.id}
                    meal={meal}
                    last={index === entries.length - 1}
                    isSaved={isItemSaved(meal, data?.saved)}
                    onPress={() => setEditing(meal)}
                    onBookmark={() => void handleBookmarkMeal(meal)}
                  />
                ))}
                {(() => {
                  const currentFeel = occasion.feel ?? day.feel[id] ?? day.feel[slot];
                  const isExpanded = expandedFeelKeys[id] ?? false;
                  const chosenOption = currentFeel
                    ? FEEL_OPTIONS.find((o) => o.value === currentFeel)
                    : undefined;

                  if (chosenOption && !isExpanded) {
                    return (
                      <View style={s.feelBar}>
                        <Text style={s.feelPrompt}>How did it feel?</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${chosenOption.label}. Tap to change.`}
                          hitSlop={4}
                          onPress={() => {
                            tap();
                            setExpandedFeelKeys((prev) => ({ ...prev, [id]: true }));
                          }}
                          style={s.feelCollapsedChip}
                        >
                          <Text style={s.feelCollapsedChipText}>{chosenOption.label}</Text>
                          <Pencil size={11} color={N.acc} />
                        </Pressable>
                      </View>
                    );
                  }

                  return (
                    <View style={s.feelBar}>
                      <Text style={s.feelPrompt}>How did it feel?</Text>
                      <View style={s.feelPills}>
                        {FEEL_OPTIONS.map((option) => {
                          const active = currentFeel === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="button"
                              accessibilityLabel={option.label}
                              hitSlop={4}
                              onPress={() => {
                                tap();
                                setExpandedFeelKeys((prev) => ({ ...prev, [id]: false }));
                                void actions.setFeel(dayKey, id, option.value);
                              }}
                              style={[s.feelPill, active && s.feelPillActive]}
                            >
                              <Text style={[s.feelPillText, active && s.feelPillTextActive]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </NCard>
            </View>
          );
        })}

        <View style={s.section}>
          <CardioSection
            entries={day.burn}
            cardStyle={false}
            emptyText="Log cardio to add part of it back to today’s budget."
            onAddPress={() => {
              tap();
              setCardioText("");
            }}
            onRemovePress={(entry) => {
              tap();
              const cardioLogs = data?.cardio[dayKey] ?? [];
              const targetLog = cardioLogs.find((b) => b.id === entry.id);
              const targetIndex = cardioLogs.findIndex((b) => b.id === entry.id);
              if (!targetLog) return;
              void actions.removeCardio(dayKey, entry.id).then((ok) => {
                if (ok) {
                  showUndoToast({
                    message: `${targetLog.name} removed`,
                    onUndo: () => {
                      void actions.restoreCardio(dayKey, targetLog, targetIndex);
                    },
                  });
                }
              });
            }}
          />
        </View>
      </ScrollView>

      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - dockHeight) > 1) {
            setDockHeight(h);
          }
        }}
        style={[
          s.dock,
          {
            bottom: dockBottomAnim,
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Log anything: 2 rotis, dal, paneer bhurji"
          placeholderTextColor={N.mute}
          selectionColor={N.acc}
          style={s.dockInput}
          multiline
          editable={!logger.busy}
          accessibilityLabel="Log food or cardio"
        />
        <Pressable
          accessibilityLabel="Log"
          accessibilityRole="button"
          accessibilityState={{ disabled: logger.busy || input.trim() === "" }}
          disabled={logger.busy || input.trim() === ""}
          onPress={() => {
            tap();
            void send();
          }}
          style={[s.send, (logger.busy || input.trim() === "") && s.sendOff]}
        >
          <Send size={20} color={N.accInk} />
        </Pressable>
      </Animated.View>

      <ReviewSheet logger={logger} />
      <ManualSheet logger={logger} />
      <EditEntrySheet
        meal={editing}
        initialSlot={editing ? slotOfMeal(editing) : "Snacks"}
        initialAt={editing ? (timeOfDay(editing.timestamp) ?? "") : ""}
        busy={editBusy}
        onClose={() => setEditing(null)}
        onSave={(factor, slot, at, macros, name, qty) => {
          if (!editing) return;

          setEditBusy(true);
          void actions
            .editEntry(editing, {
              factor,
              slot,
              at,
              macros,
              name,
              qty,
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
          const targetMeal = editing;
          setEditing(null);
          void actions.removeEntry(targetMeal.id).then((ok) => {
            if (ok) {
              showUndoToast({
                message: `${targetMeal.name} deleted`,
                onUndo: () => {
                  void actions.restoreEntry(targetMeal);
                },
              });
            }
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
      <DayPickerSheet
        visible={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        selectedKey={dayKey}
        todayKey={todayKey}
        loggedDayKeys={loggedDayKeys}
        onSelectDay={(key) => setPicked(key === todayKey ? null : key)}
      />
      <Sheet
        visible={renamingOccasion !== null}
        onClose={() => setRenamingOccasion(null)}
        title="Rename occasion"
        footer={
          <Button
            label="Save title"
            kind="primary"
            onPress={() => void handleSaveOccasionTitle(renameInput)}
          />
        }
      >
        <View style={{ gap: 12, paddingBottom: 16 }}>
          <Field
            label="Occasion title"
            value={renameInput}
            onChangeText={setRenameInput}
            placeholder="e.g. Pre-workout, Post-workout, Late snack"
            autoFocus
          />
        </View>
      </Sheet>
      <Sheet
        visible={savingMealOccasion !== null}
        onClose={() => setSavingMealOccasion(null)}
        title="Save meal"
        footer={
          <Button
            label="Save meal"
            kind="primary"
            onPress={() => void handleSaveMeal()}
            disabled={saveMealBusy || !saveMealName.trim()}
          />
        }
      >
        <View style={{ gap: 14, paddingBottom: 16 }}>
          <Field
            label="Meal name"
            value={saveMealName}
            onChangeText={setSaveMealName}
            placeholder="e.g. My Breakfast"
            autoFocus
          />
          {savingMealOccasion && (
            <View style={s.saveMealItemsContainer}>
              <Text style={s.saveMealItemsHeader}>
                Included items ({savingMealOccasion.meals.length})
              </Text>
              <View style={s.saveMealItemsList}>
                {savingMealOccasion.meals.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      s.saveMealItemRow,
                      idx < savingMealOccasion.meals.length - 1 && s.saveMealItemBorder,
                    ]}
                  >
                    <Text style={s.saveMealItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={s.saveMealItemMeta}>
                      {item.qty ?? "1 serving"} · {fmtInt(item.calories ?? 0)} kcal
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Sheet>
    </View>
  );
}


function EntryRow({
  meal,
  last,
  isSaved,
  onPress,
  onBookmark,
}: {
  meal: Meal;
  last: boolean;
  isSaved: boolean;
  onPress: () => void;
  onBookmark: () => void;
}) {
  const conf = confidenceLabel(confidenceOf(meal));

  return (
    <View style={[s.entry, !last && s.entryLine]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${meal.name}`}
        onPress={() => {
          tap();
          onPress();
        }}
        style={s.entryMainPressable}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSaved ? `${meal.name} is saved` : `Save ${meal.name}`}
        hitSlop={12}
        onPress={() => {
          tap();
          onBookmark();
        }}
        style={s.bookmarkBtn}
      >
        <Bookmark
          size={16}
          color={isSaved ? N.acc : N.mute}
          fill={isSaved ? N.acc : "none"}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 0, paddingBottom: 120 },
  mute: { color: N.mute, fontSize: 13 },
  hidden: { opacity: 0 },
  dayStrip: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  dayNavBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dayTitle: { fontFamily: NSerif, fontWeight: "400", fontSize: 16, color: N.ink },
  daySubtitle: { fontSize: 14, color: N.mute },
  hero: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 12 },
  ringNumber: {
    fontFamily: NSerif,
    fontWeight: "400",
    fontSize: 28,
    color: N.ink,
    fontVariant: ["tabular-nums"],
  },
  ringSub: { color: N.mute, fontSize: 12, marginTop: 2 },
  stats: { flex: 1, gap: 10 },
  stat: {},
  statLabel: {
    color: N.mute,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: {
    color: N.ink,
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  statNote: { color: N.mute, fontSize: 12, fontWeight: "400" },
  macros: { gap: 12, marginBottom: 12 },
  macro: {},
  macroHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  macroLabel: { color: N.ink, fontSize: 14 },
  macroValue: {
    color: N.mute,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  microLink: { color: N.acc, fontSize: 13, alignSelf: "flex-end" },
  chips: { gap: 8, paddingVertical: 6, paddingRight: 0 },
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveMealHeaderBtn: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 8,
    backgroundColor: N.card2,
    borderWidth: 1,
    borderColor: N.line,
    alignItems: "center",
    justifyContent: "center",
  },
  renameBtn: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: NSerif, fontWeight: "400", fontSize: 20, color: N.ink },
  sectionSub: {
    color: N.mute,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  empty: { color: N.dim, fontSize: 14, paddingVertical: 6 },
  rows: { padding: 0, overflow: "hidden" },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  entryMainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bookmarkBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  entryLine: { borderBottomWidth: 1, borderBottomColor: N.line },
  entryMain: { flex: 1 },
  entryName: { color: N.ink, fontSize: 15, fontWeight: "500" },
  entrySub: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  entryKcal: {
    color: N.ink,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  remove: { color: N.dim, fontSize: 16, paddingHorizontal: 4 },
  feelBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: N.line,
  },
  feelPrompt: {
    color: N.mute,
    fontSize: 12,
  },
  feelPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: N.card2,
    borderWidth: 1,
    borderColor: N.line,
  },
  feelPillActive: {
    backgroundColor: `${N.acc}25`,
    borderColor: N.acc,
  },
  feelPillText: {
    color: N.mute,
    fontSize: 12,
    fontWeight: "500",
  },
  feelPillTextActive: {
    color: N.acc,
    fontWeight: "600",
  },
  saveMealItemsContainer: {
    marginTop: 4,
    gap: 8,
  },
  saveMealItemsHeader: {
    color: N.mute,
    fontSize: 12,
    fontWeight: "500",
  },
  saveMealItemsList: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  saveMealItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  saveMealItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: N.line,
  },
  saveMealItemName: {
    color: N.ink,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  saveMealItemMeta: {
    color: N.mute,
    fontSize: 12,
  },
  feelCollapsedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: `${N.acc}22`,
    borderWidth: 1,
    borderColor: `${N.acc}66`,
  },
  feelCollapsedChipText: {
    color: N.acc,
    fontSize: 12,
    fontWeight: "600",
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: N.dockBg,
    borderRadius: NRadius.pill,
    borderWidth: 1.5,
    borderColor: N.acc,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  dockInput: {
    flex: 1,
    color: N.ink,
    fontSize: 16,
    minHeight: 44,
    maxHeight: 120,
    paddingVertical: 8,
  },
  send: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: N.acc,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
});
