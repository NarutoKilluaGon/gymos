import {
  BookOpen,
  Droplets,
  Dumbbell,
  HeartPulse,
  ListChecks,
  Moon,
  Ruler,
  Scale,
  Target,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import {
  GymColors,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { TimelineItem as TimelineItemData } from "@/types/timeline";

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

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(
    [],
    { hour: "numeric", minute: "2-digit" },
  );
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return "";
  const minutes = Math.round(durationMs / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
}

type ItemConfig = {
  Icon: LucideIcon;
  title: string;
  caption: string;
};

function getConfig(
  item: TimelineItemData,
): ItemConfig {
  switch (item.kind) {
    case "journal":
      return {
        Icon: BookOpen,
        title: item.text,
        caption: item.mood ? `Feeling ${MOOD_EMOJI[item.mood] ?? item.mood}` : "",
      };

    case "workout": {
      const caption =
        `${item.exerciseCount} exercises` +
        (item.durationMs !== undefined
          ? ` · ${formatDuration(item.durationMs)}`
          : "") +
        (item.notes ? `\n${item.notes}` : "");

      return {
        Icon: Dumbbell,
        title: `Workout completed — ${item.name}`,
        caption,
      };
    }

    case "meal": {
      const caption =
        item.calories !== undefined
          ? `${item.calories} kcal` +
            (item.protein !== undefined
              ? ` · ${item.protein}g protein`
              : "")
          : "Meal";

      return {
        Icon: Utensils,
        title: `Logged ${item.name}`,
        caption,
      };
    }

    case "measurement": {
      const label =
        MEASUREMENT_LABELS[item.type] ?? item.type;

      return {
        Icon: Ruler,
        title: `${label} logged`,
        caption: `${item.value} ${item.unit}`,
      };
    }

    case "weight":
      return {
        Icon: Scale,
        title: "Weight logged",
        caption: `${item.weight} ${item.unit}`,
      };

    case "water":
      return {
        Icon: Droplets,
        title: "Water logged",
        caption: `${item.amountMl} ml`,
      };

    case "sleep":
      return {
        Icon: Moon,
        title: "Sleep ended",
        caption: "",
      };

    case "northstar":
      return {
        Icon: Target,
        title: "North Star changed",
        caption: item.title,
      };

    case "routine":
      return {
        Icon: ListChecks,
        title: "Routine created",
        caption: item.name,
      };

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
        title: `${label} logged`,
        caption,
      };
    }
  }
}

type TimelineItemProps = {
  item: TimelineItemData;
};

export function TimelineItem({
  item,
}: TimelineItemProps) {
  const { Icon, title, caption } =
    getConfig(item);

  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <Icon
          size={18}
          color={GymColors.text.secondary}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={styles.title}
            numberOfLines={item.kind === "journal" ? 4 : 2}
          >
            {title}
          </Text>

          <Text style={styles.time}>
            {formatTime(item.timestamp)}
          </Text>
        </View>

        {caption ? (
          <Text style={styles.caption}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.three,
    backgroundColor: GymColors.background.card,
    borderRadius: 16,
    padding: Spacing.three,
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },

  title: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    lineHeight: 21,
  },

  time: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: 2,
  },

  caption: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },
});