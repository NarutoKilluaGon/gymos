import * as Haptics from "expo-haptics";
import {
  Droplets,
  Dumbbell,
  Flame,
  Utensils,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  requestNotificationPermission,
} from "@/services/notifications";
import {
  getReminderPrefs,
  saveReminderPrefs,
  type ReminderPrefs,
} from "@/storage/repositories/reminders";
import { showToast } from "@/utils/toast";

type RemindersSheetProps = {
  onClose: () => void;
  onSaved: (prefs: ReminderPrefs) => void;
};

const ROWS: {
  kind: keyof ReminderPrefs;
  name: string;
  description: string;
  Icon: typeof Dumbbell;
}[] = [
  {
    kind: "workout",
    name: "Workout",
    description: "Daily nudge to train",
    Icon: Dumbbell,
  },
  {
    kind: "meals",
    name: "Meals",
    description: "Remind me to log a meal",
    Icon: Utensils,
  },
  {
    kind: "water",
    name: "Water",
    description: "Hydrate every few hours",
    Icon: Droplets,
  },
  {
    kind: "streak",
    name: "Streak",
    description: "Stay consistent daily",
    Icon: Flame,
  },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 24h steppers, but previewed as 12-hour clock. */
function formatTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${pad(minute)} ${suffix}`;
}

function StepperRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const decrement = () =>
    onChange(Math.max(min, value - step));
  const increment = () =>
    onChange(Math.min(max, value + step));

  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>

      <View style={styles.stepperControls}>
        <Pressable
          onPress={decrement}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={[
            styles.stepperButton,
            value <= min && styles.stepperButtonDisabled,
          ]}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>

        <Text style={styles.stepperValue}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>

        <Pressable
          onPress={increment}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={[
            styles.stepperButton,
            value >= max && styles.stepperButtonDisabled,
          ]}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RemindersSheet({
  onClose,
  onSaved,
}: RemindersSheetProps) {
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);

  useEffect(() => {
    let mounted = true;

    getReminderPrefs().then((loaded) => {
      if (mounted) {
        setPrefs(loaded);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!prefs) {
    return <View style={styles.container} />;
  }

  /** Toggle a reminder; requests notification permission when enabling. */
  async function handleToggle(kind: keyof ReminderPrefs, enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();

      if (!granted) {
        showToast("Notifications are off in device settings");
        return;
      }
    }

    setPrefs((current) =>
      current
        ? {
            ...current,
            [kind]: { ...current[kind], enabled },
          }
        : current,
    );
  }

  async function handleSave() {
    if (!prefs) return;

    const anyEnabled = ROWS.some(
      ({ kind }) => prefs[kind].enabled,
    );

    if (anyEnabled) {
      const granted = await requestNotificationPermission();

      if (!granted) {
        showToast("Notifications are off in device settings");
        return;
      }
    }

    try {
      await saveReminderPrefs(prefs);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      onSaved(prefs);
      onClose();
    } catch {
      showToast("Couldn't save reminders");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reminders</Text>

          <Text style={styles.subtitle}>
            Gentle local nudges — nothing leaves the device.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reminders"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {ROWS.map(({ kind, name, description, Icon }) => {
          const enabled = prefs[kind].enabled;

          return (
            <View
              key={kind}
              style={styles.row}
            >
              <View style={styles.rowHeader}>
                <View style={styles.rowMain}>
                  <View style={styles.iconContainer}>
                    <Icon size={20} color={GymColors.text.primary} />
                  </View>

                  <View style={styles.textBlock}>
                    <Text style={styles.rowText}>{name}</Text>

                    <Text style={styles.rowSubtitle}>
                      {description}
                    </Text>
                  </View>
                </View>

                <Switch
                  accessibilityLabel={`Toggle ${name} reminder`}
                  value={enabled}
                  onValueChange={(value) =>
                    void handleToggle(kind, value)
                  }
                  trackColor={{
                    false: GymColors.background.surface,
                    true: GymColors.semantic.accent,
                  }}
                  thumbColor={GymColors.background.primary}
                />
              </View>

              {enabled &&
                (kind === "water" ? (
                  <StepperRow
                    label="Every"
                    value={prefs.water.intervalHours}
                    onChange={(v) =>
                      setPrefs((current) =>
                        current
                          ? {
                              ...current,
                              water: {
                                ...current.water,
                                intervalHours: v,
                              },
                            }
                          : current,
                      )
                    }
                    min={1}
                    max={8}
                    unit="h"
                  />
                ) : (
                  <View style={styles.timeSteppers}>
                    <StepperRow
                      label="Hour"
                      value={prefs[kind].time.hour}
                      onChange={(v) =>
                        setPrefs((current) =>
                          current
                            ? {
                                ...current,
                                [kind]: {
                                  ...current[kind],
                                  time: {
                                    ...current[kind].time,
                                    hour: v,
                                  },
                                },
                              }
                            : current,
                        )
                      }
                      min={0}
                      max={23}
                    />

                    <StepperRow
                      label="Minute"
                      value={prefs[kind].time.minute}
                      onChange={(v) =>
                        setPrefs((current) =>
                          current
                            ? {
                                ...current,
                                [kind]: {
                                  ...current[kind],
                                  time: {
                                    ...current[kind].time,
                                    minute: v,
                                  },
                                },
                              }
                            : current,
                        )
                      }
                      min={0}
                      max={55}
                      step={5}
                    />

                    <Text style={styles.previewTime}>
                      {formatTime(
                        prefs[kind].time.hour,
                        prefs[kind].time.minute,
                      )}
                    </Text>
                  </View>
                ))}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => void handleSave()}
        accessibilityRole="button"
        accessibilityLabel="Save reminders"
        style={styles.saveButton}
      >
        <Text style={styles.saveText}>Save reminders</Text>
      </Pressable>
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
    maxHeight: "78%",
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

  list: {
    flexGrow: 0,
  },

  row: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
  },

  rowText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  rowSubtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  timeSteppers: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  stepperLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },

  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  stepperButtonDisabled: {
    opacity: 0.4,
  },

  stepperButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "600",
    lineHeight: 22,
  },

  stepperValue: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    minWidth: 42,
    textAlign: "center",
  },

  previewTime: {
    color: GymColors.semantic.accent,
    fontSize: Typography.caption,
    fontWeight: "600",
    textAlign: "right",
  },

  saveButton: {
    marginTop: Spacing.two,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});