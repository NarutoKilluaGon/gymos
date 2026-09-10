import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EmptyMeals } from "@/components/nutrition/empty-meals";
import { MealCard } from "@/components/nutrition/meal-card";
import { NutritionSummaryCard } from "@/components/nutrition/nutrition-summary-card";
import { QuickMealPickerSheet } from "@/components/nutrition/quick-meal-picker-sheet";
import { SavedFoodsSheet } from "@/components/nutrition/saved-foods-sheet";
import {
  MealSheet,
  type MealInput,
} from "@/components/quick-add/meal-sheet";
import { FadeIn } from "@/components/ui/fade-in";
import { ModuleDisabled } from "@/components/ui/module-disabled";
import { useModules } from "@/contexts/modules-context";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { Utensils } from "lucide-react-native";
import {
  addMeal,
  deleteMeal,
  getTodayMeals,
  type MacroTotals,
} from "@/storage/repositories/meals";
import {
  getNutritionTargets,
  type NutritionTargets,
} from "@/storage/repositories/nutrition-targets";
import {
  deleteSavedFood,
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { Meal } from "@/types/gymos";
import { showToast } from "@/utils/toast";
import {
  estimateMealFromPhoto,
  getVisionProvider,
  type MealEstimate,
} from "@/services/meal-estimator";

function sumMacros(meals: Meal[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (totals, meal) => ({
      calories: totals.calories + (meal.calories ?? 0),
      protein: totals.protein + (meal.protein ?? 0),
      carbs: totals.carbs + (meal.carbs ?? 0),
      fat: totals.fat + (meal.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export default function NutritionScreen() {
  const { enabled } = useModules();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>({});
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [savedFoodsSheetOpen, setSavedFoodsSheetOpen] =
    useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [quickPickOpen, setQuickPickOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [estimatedMeal, setEstimatedMeal] = useState<MealInput | null>(null);

  useEffect(() => {
    async function loadNutrition() {
      try {
        setMeals(await getTodayMeals());
        setTargets(await getNutritionTargets());
        setSavedFoods(await getSavedFoods());
      } catch {
        showToast("Couldn't load nutrition");
      }
    }
    loadNutrition();
  }, []);

  async function handleAddMeal(meal: MealInput) {
    try {
      const saved = await addMeal(meal.name, {
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      });
      setMeals((current) => [...current, saved]);
      setMealSheetOpen(false);
      setEstimatedMeal(null);
    } catch {
      showToast("Couldn't save meal");
    }
  }

  async function handleQuickAdd(food: SavedFood) {
    try {
      await addMeal(food.name, {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      });
      const savedFoodsLatest = await getSavedFoods();
      setSavedFoods(savedFoodsLatest);
      setMeals(await getTodayMeals());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      showToast("Couldn't log meal");
    }
  }

  async function handleDeleteMeal(mealId: string) {
    if (deleting) return;
    setDeleting(mealId);
    try {
      await deleteMeal(mealId);
      setMeals((current) =>
        current.filter((m) => m.id !== mealId),
      );
    } catch {
      showToast("Couldn't delete meal");
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteSavedFood(id: string) {
    try {
      await deleteSavedFood(id);
      setSavedFoods((current) =>
        current.filter((f) => f.id !== id),
      );
    } catch {
      showToast("Couldn't delete saved food");
    }
  }

  function handleQuickPickSelect(meal: MealEstimate) {
    setEstimatedMeal(meal);
    setQuickPickOpen(false);
    setMealSheetOpen(true);
  }

  function handleMealSheetClose() {
    setMealSheetOpen(false);
    setEstimatedMeal(null);
  }

  async function handleScanPhoto() {
    if (scanning) return;
    setScanning(true);
    try {
      const estimate = await estimateMealFromPhoto();
      if (estimate) {
        // AI estimate returned — pre-fill meal sheet
        setEstimatedMeal(estimate);
        setMealSheetOpen(true);
      } else if (getVisionProvider() === null) {
        // No AI provider configured → open quick-pick catalog
        setQuickPickOpen(true);
      }
      // If provider exists but returned null (error/cancel), do nothing
    } finally {
      setScanning(false);
    }
  }

  if (!enabled.nutrition) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="nutrition"
          title="Nutrition"
          description="Log meals, track macros, and manage your saved foods."
          Icon={Utensils}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NUTRITION</Text>
        <Text style={styles.title}>Nutrition</Text>

        <FadeIn delay={0}>
          <NutritionSummaryCard
            totals={sumMacros(meals)}
            targets={targets}
          />
        </FadeIn>

        <View style={styles.mealsHeader}>
          <Text style={styles.sectionTitle}>Meals</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setSavedFoodsSheetOpen(true)}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Open saved foods"
            >
              <Text style={styles.addButtonText}>Saved</Text>
            </Pressable>

            <Pressable
              onPress={() => setMealSheetOpen(true)}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Add meal"
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>

            <Pressable
              onPress={() => setQuickPickOpen(true)}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Quick pick a meal with estimated macros"
            >
              <Text style={styles.addButtonText}>Quick</Text>
            </Pressable>

            <Pressable
              onPress={handleScanPhoto}
              disabled={scanning}
              style={[
                styles.addButton,
                scanning && styles.addButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={scanning ? "Analyzing photo…" : "Scan food photo for macros"}
            >
              <Text style={styles.addButtonText}>
                {scanning ? "Scan…" : "Scan"}
              </Text>
            </Pressable>
          </View>
        </View>

        {meals.length === 0 ? (
          <EmptyMeals
            onAddMeal={() => setMealSheetOpen(true)}
          />
        ) : (
          <View style={styles.mealList}>
            {[...meals]
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime(),
              )
              .map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  deleting={deleting === meal.id}
                  onDelete={() => handleDeleteMeal(meal.id)}
                />
              ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={savedFoodsSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSavedFoodsSheetOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setSavedFoodsSheetOpen(false)}
          />
          <SavedFoodsSheet
            foods={savedFoods}
            adding={deleting !== null}
            onSelect={handleQuickAdd}
            onDelete={handleDeleteSavedFood}
            onClose={() => setSavedFoodsSheetOpen(false)}
          />
        </View>
      </Modal>

      <Modal
        visible={quickPickOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickPickOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setQuickPickOpen(false)}
          />
          <QuickMealPickerSheet
            onSelect={handleQuickPickSelect}
            onClose={() => setQuickPickOpen(false)}
          />
        </View>
      </Modal>

      <MealSheet
        visible={mealSheetOpen}
        allowFavorite
        initialMeal={estimatedMeal ?? undefined}
        onSave={handleAddMeal}
        onClose={handleMealSheetClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  mealsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },

  sectionTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  actions: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
  },

  addButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  addButtonDisabled: {
    opacity: 0.5,
  },

  mealList: {
    gap: Spacing.two,
  },

  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
});