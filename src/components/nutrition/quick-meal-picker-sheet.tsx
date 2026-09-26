import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  foodEntryToEstimate,
  searchFoods,
} from "@/services/food-db";
import {
  mealInputFromEstimate,
  searchQuickMeals,
  type MealEstimate,
} from "@/services/meal-estimator";

type QuickMealPickerSheetProps = {
  onSelect: (meal: MealEstimate) => void;
  onClose: () => void;
};

export function QuickMealPickerSheet({
  onSelect,
  onClose,
}: QuickMealPickerSheetProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchQuickMeals(query),
    [query],
  );

  // Offline food database — manual food selection (Slice 3A). Same
  // search semantics as the quick-pick catalog above.
  const foodResults = useMemo(
    () => searchFoods(query),
    [query],
  );

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>Quick pick</Text>

          <Text style={styles.subtitle}>
            Common meals with estimated macros —
            edit before saving.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close quick pick"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods…"
        placeholderTextColor={GymColors.text.tertiary}
        style={styles.search}
        autoCorrect={false}
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {results.map((meal) => {
          const input = mealInputFromEstimate(meal);

          return (
            <Pressable
              key={input.name}
              onPress={() => onSelect(meal)}
              accessibilityRole="button"
              accessibilityLabel={`Pick ${input.name}`}
              style={styles.row}
            >
              <View style={styles.rowTextBlock}>
                <Text style={styles.rowName}>
                  {input.name}
                </Text>

                <Text style={styles.rowMacros}>
                  {input.calories} kcal · {input.protein}g protein
                  {input.carbs ? ` · ${input.carbs}g carbs` : ""}
                  {input.fat ? ` · ${input.fat}g fat` : ""}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}

        {/* Tapping a food wraps it as a single-food estimate and follows
            the same onSelect → MealSheet review → save path as quick
            pick, so manual selection needs no second save pipeline. */}
        <Text style={styles.sectionLabel}>Food database</Text>

        {foodResults.map((entry) => (
          <Pressable
            key={`db-${entry.id}`}
            onPress={() => onSelect(foodEntryToEstimate(entry))}
            accessibilityRole="button"
            accessibilityLabel={`Pick ${entry.name}`}
            style={styles.row}
          >
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowName}>{entry.name}</Text>

              <Text style={styles.rowMacros}>
                {entry.amount} {entry.unit} · {entry.calories} kcal ·{" "}
                {entry.protein}g protein
                {entry.carbs ? ` · ${entry.carbs}g carbs` : ""}
                {entry.fat ? ` · ${entry.fat}g fat` : ""}
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    height: "70%",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  headerTitleBlock: {
    flex: 1,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
    lineHeight: 18,
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: GymColors.text.secondary,
    fontSize: 30,
    fontWeight: "300",
  },

  search: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },

  sectionLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
    marginTop: Spacing.two,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    gap: Spacing.two,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  rowTextBlock: {
    flex: 1,
  },

  rowName: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  rowMacros: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  chevron: {
    color: GymColors.text.tertiary,
    fontSize: 22,
    fontWeight: "300",
  },
});