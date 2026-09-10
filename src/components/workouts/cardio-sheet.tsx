import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { CARDIO_ACTIVITIES, findCardioActivity } from "@/data/cardio";
import type { CardioActivity } from "@/types/gymos";

type CardioSheetProps = {
  activity: CardioActivity;
  customName: string;
  duration: string;
  distance: string;
  calories: string;
  saving: boolean;
  onActivityChange: (activity: CardioActivity) => void;
  onCustomNameChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onDistanceChange: (value: string) => void;
  onCaloriesChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function CardioSheet({
  activity,
  customName,
  duration,
  distance,
  calories,
  saving,
  onActivityChange,
  onCustomNameChange,
  onDurationChange,
  onDistanceChange,
  onCaloriesChange,
  onSave,
  onClose,
}: CardioSheetProps) {
  const activeDef = findCardioActivity(activity);
  const showDistance =
    activity !== "custom" && activeDef?.hasDistance === true;
  const showCustomName = activity === "custom";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Add Cardio</Text>

          <Text style={styles.subtitle}>Log a cardio session.</Text>
        </View>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close cardio input"
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.label}>Activity</Text>

          <View style={styles.chips}>
            {CARDIO_ACTIVITIES.map((item) => {
              const selected = item.id === activity;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onActivityChange(item.id)}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                >
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>

                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showCustomName && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>

            <TextInput
              value={customName}
              onChangeText={onCustomNameChange}
              placeholder="e.g. Hike"
              placeholderTextColor={GymColors.text.tertiary}
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration (minutes)</Text>

          <TextInput
            value={duration}
            onChangeText={onDurationChange}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={GymColors.text.tertiary}
            style={styles.input}
          />
        </View>

        {showDistance && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Distance (km)</Text>

            <TextInput
              value={distance}
              onChangeText={onDistanceChange}
              keyboardType="decimal-pad"
              placeholder="5.0"
              placeholderTextColor={GymColors.text.tertiary}
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Calories (optional)</Text>

          <TextInput
            value={calories}
            onChangeText={onCaloriesChange}
            keyboardType="number-pad"
            placeholder="350"
            placeholderTextColor={GymColors.text.tertiary}
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save cardio"
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Add Cardio"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
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

  scroll: {
    maxHeight: 520,
  },

  section: {
    marginBottom: Spacing.three,
  },

  label: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.two,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  chipSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  chipEmoji: {
    fontSize: 14,
  },

  chipText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  chipTextSelected: {
    color: GymColors.background.primary,
  },

  inputGroup: {
    marginBottom: Spacing.three,
  },

  input: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  saveButton: {
    marginTop: Spacing.one,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});