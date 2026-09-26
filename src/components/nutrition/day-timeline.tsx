import {
  Activity,
  BookOpen,
  Droplets,
  Dumbbell,
  Footprints,
  HeartPulse,
  ListChecks,
  Moon,
  Ruler,
  Scale,
  Target,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GymCard } from "@/components/ui/gym-card";
import { MealCard } from "@/components/nutrition/meal-card";
import { formatMealTime } from "@/components/nutrition/meal-timeline";
import { GymColors, Spacing, Typography } from "@/constants/theme";
import type { DayTimelineEntry } from "@/services/day-timeline";
import type { Meal } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";

const CARDIO_LABELS: Record<string, string> = {
  running: "Running",
  walking: "Walking",
  cycling: "Cycling",
  swimming: "Swimming",
  stairmaster: "Stairmaster",
  rowing: "Rowing",
  elliptical: "Elliptical",
  custom: "Cardio",
};

const MEASUREMENT_LABELS: Record<string, string> = {
  weight: "Weight",
  bodyFat: "Body fat",
  biceps: "Biceps",
  waist: "Waist",
  chest: "Chest",
  thigh: "Thigh",
};

const MOOD_EMOJI: Record<string, string> = {
  great: "😄",
  good: "🙂",
  okay: "😐",
  tired: "😴",
  rough: "😞",
};

function formatWorkoutDuration(durationMs?: number): string {
  if (durationMs === undefined) {
    return "";
  }

  const minutes = Math.round(durationMs / 60000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

type ActivityCopy = {
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  caption: string;
};

/**
 * Compact copy for one event-timeline row. Mirrors the Journal
 * timeline's wording (same icons, same labels) so the day view and the
 * journal agree — meal rows are never built here (they render as full
 * S6A MealCards from the daily store instead).
 */
function getActivityCopy(item: TimelineItem): ActivityCopy {
  switch (item.kind) {
    case "workout": {
      const duration = formatWorkoutDuration(item.durationMs);
      const caption =
        `${item.exerciseCount} exercise${item.exerciseCount === 1 ? "" : "s"}` +
        (duration ? ` · ${duration}` : "") +
        (item.notes ? `\n${item.notes}` : "");

      return {
        Icon: Dumbbell,
        eyebrow: "WORKOUT",
        title: item.name,
        caption,
      };
    }

    case "cardio": {
      const label = CARDIO_LABELS[item.activity] ?? item.activity;
      const caption =
        `${item.durationMin} min` +
        (item.distanceKm !== undefined
          ? ` · ${item.distanceKm} km`
          : "") +
        (item.calories !== undefined
          ? ` · ${item.calories} kcal`
          : "");

      return {
        Icon: HeartPulse,
        eyebrow: "CARDIO",
        title: label,
        caption,
      };
    }

    case "water":
      return {
        Icon: Droplets,
        eyebrow: "WATER",
        title: "Water",
        caption: `${item.amountMl} ml`,
      };

    case "sleep":
      return {
        Icon: Moon,
        eyebrow: "SLEEP",
        title: "Sleep",
        caption: "",
      };

    case "measurement": {
      const label = MEASUREMENT_LABELS[item.type] ?? item.type;

      return {
        Icon: Ruler,
        eyebrow: "MEASUREMENT",
        title: label,
        caption: `${item.value} ${item.unit}`,
      };
    }

    case "weight":
      return {
        Icon: Scale,
        eyebrow: "WEIGHT",
        title: "Weight",
        caption: `${item.weight} ${item.unit}`,
      };

    case "northstar":
      return {
        Icon: Target,
        eyebrow: "NORTH STAR",
        title: "North Star",
        caption: item.title,
      };

    case "routine":
      return {
        Icon: ListChecks,
        eyebrow: "ROUTINE",
        title: "Routine",
        caption: item.name,
      };

    case "journal":
      return {
        Icon: BookOpen,
        eyebrow: "NOTE",
        title: item.text,
        caption: item.mood
          ? `Feeling ${MOOD_EMOJI[item.mood] ?? item.mood}`
          : "",
      };

    case "meal":
      // Unreachable: the builder excludes event-log meal summaries so
      // the daily store's full meal cards are the single rendering.
      // Kept so an unexpected item still shows something, never blank.
      return {
        Icon: Activity,
        eyebrow: "MEAL",
        title: item.name,
        caption: "",
      };

    default:
      // Unknown future event kinds degrade to a generic row (the
      // builder only lets through items with an id + timestamp).
      return {
        Icon: Activity,
        eyebrow: "ACTIVITY",
        title: "Activity logged",
        caption: "",
      };
  }
}

type DotTone = "meal" | "workout" | "cardio" | "steps" | "other";

function dotToneFor(entry: DayTimelineEntry): DotTone {
  if (entry.type === "meal") {
    return "meal";
  }

  if (entry.type === "steps") {
    return "steps";
  }

  if (entry.item.kind === "workout") {
    return "workout";
  }

  if (entry.item.kind === "cardio") {
    return "cardio";
  }

  return "other";
}

const DOT_COLORS: Record<DotTone, string> = {
  meal: GymColors.semantic.accent,
  workout: GymColors.semantic.success,
  cardio: GymColors.semantic.warning,
  steps: GymColors.text.secondary,
  other: GymColors.text.tertiary,
};

function entryTime(entry: DayTimelineEntry): string {
  if (entry.type === "steps") {
    // Steps are a day-level total with no persisted timestamp — the
    // gutter names the span instead of inventing a time.
    return "Today";
  }

  if (entry.type === "meal") {
    return formatMealTime(entry.meal.timestamp);
  }

  return formatMealTime(entry.item.timestamp);
}

function entryKey(entry: DayTimelineEntry, index: number): string {
  if (entry.type === "meal") {
    return `meal-${entry.meal.id ?? index}`;
  }

  if (entry.type === "steps") {
    return "steps-today";
  }

  return `${entry.item.kind}-${entry.item.id}`;
}

type DayTimelineProps = {
  /** Chronological ascending — the builder owns ordering. */
  entries: DayTimelineEntry[];
  deletingId: string | null;
  onDeleteMeal: (id: string) => void;
  onEditMeal: (meal: Meal) => void;
  /** Existing drill-down: workouts (and their cardio) live in the
   *  Workouts tab — same destination as the dashboard workout card. */
  onOpenWorkouts: () => void;
};

/**
 * One continuous chronological rail for the day: meals (full S6A cards,
 * tap to edit), workouts and cardio (visually distinct, tap to open the
 * Workouts tab), steps as their own closing row, and the remaining
 * event-timeline kinds as compact read-only rows. Time lives in the
 * gutter — never duplicated inside cards. Malformed records degrade to
 * blank times/generic rows; they never crash the list.
 */
export function DayTimeline({
  entries,
  deletingId,
  onDeleteMeal,
  onEditMeal,
  onOpenWorkouts,
}: DayTimelineProps) {
  return (
    <View style={styles.list}>
      {entries.map((entry, index) => (
        <View key={entryKey(entry, index)} style={styles.row}>
          <View style={styles.timeWrap}>
            <Text style={styles.time}>{entryTime(entry)}</Text>
          </View>

          <View style={styles.rail}>
            <View
              style={[styles.line, index === 0 && styles.lineHidden]}
            />

            <View
              style={[
                styles.dot,
                { backgroundColor: DOT_COLORS[dotToneFor(entry)] },
              ]}
            />

            <View
              style={[
                styles.line,
                index === entries.length - 1 && styles.lineHidden,
              ]}
            />
          </View>

          <View style={styles.cardWrap}>
            {entry.type === "meal" ? (
              <Pressable
                onPress={() => onEditMeal(entry.meal)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${entry.meal.name}`}
              >
                <MealCard
                  meal={entry.meal}
                  deleting={deletingId === entry.meal.id}
                  onDelete={() => onDeleteMeal(entry.meal.id)}
                />
              </Pressable>
            ) : entry.type === "steps" ? (
              <GymCard style={styles.activityCard}>
                <View style={styles.activityTop}>
                  <View style={styles.iconChip}>
                    <Footprints
                      size={18}
                      color={GymColors.text.secondary}
                    />
                  </View>

                  <View style={styles.activityBody}>
                    <Text style={styles.eyebrow}>STEPS</Text>

                    <Text style={styles.activityTitle}>
                      {entry.count.toLocaleString()} steps
                    </Text>

                    <Text style={styles.activityCaption}>
                      Today&apos;s total
                    </Text>
                  </View>
                </View>
              </GymCard>
            ) : (
              <ActivityRow
                item={entry.item}
                onOpenWorkouts={onOpenWorkouts}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function ActivityRow({
  item,
  onOpenWorkouts,
}: {
  item: TimelineItem;
  onOpenWorkouts: () => void;
}) {
  const { Icon, eyebrow, title, caption } = getActivityCopy(item);
  const tappable = item.kind === "workout" || item.kind === "cardio";

  const body = (
    <GymCard
      style={[styles.activityCard, item.kind !== "workout" && item.kind !== "cardio" && styles.quietCard]}
    >
      <View style={styles.activityTop}>
        <View style={styles.iconChip}>
          <Icon size={18} color={GymColors.text.secondary} />
        </View>

        <View style={styles.activityBody}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>

          <Text
            style={styles.activityTitle}
            numberOfLines={item.kind === "journal" ? 2 : 3}
          >
            {title}
          </Text>

          {caption ? (
            <Text style={styles.activityCaption}>{caption}</Text>
          ) : null}
        </View>
      </View>
    </GymCard>
  );

  if (!tappable) {
    return body;
  }

  return (
    <Pressable
      onPress={onOpenWorkouts}
      accessibilityRole="button"
      accessibilityLabel={
        item.kind === "workout" ? "Open workouts" : "Open cardio in workouts"
      }
    >
      {body}
    </Pressable>
  );
}

const RAIL_WIDTH = 16;
const DOT_SIZE = 12;

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },

  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },

  timeWrap: {
    width: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  time: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "right",
  },

  rail: {
    width: RAIL_WIDTH,
    alignItems: "center",
  },

  line: {
    flex: 1,
    width: 2,
    backgroundColor: GymColors.background.surface,
  },

  lineHidden: {
    opacity: 0,
  },

  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  cardWrap: {
    flex: 1,
  },

  activityCard: {
    gap: Spacing.two,
  },

  quietCard: {
    opacity: 0.85,
  },

  activityTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },

  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  activityBody: {
    flex: 1,
    gap: 2,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
    letterSpacing: 1,
  },

  activityTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  activityCaption: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },
});
