import { BookOpenText, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { JournalSheet } from "@/components/quick-add/journal-sheet";
import { TimelineItem } from "@/components/journal/timeline-item";
import { SkeletonList } from "@/components/ui/skeleton";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { getTimeline } from "@/services/timeline";
import { showToast } from "@/utils/toast";
import {
  addJournalEntry,
  deleteJournalEntry,
} from "@/storage/repositories/journal";
import type { JournalEntry } from "@/types/gymos";
import type { TimelineItem as TimelineItemType } from "@/types/timeline";
import { getTodayKey } from "@/utils/date";

function getDayKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function formatDayLabel(dayKey: string): string {
  const today = getTodayKey();

  if (dayKey === today) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getDayKey(
    yesterday.toISOString(),
  );

  if (dayKey === yesterdayKey) return "Yesterday";

  const date = new Date(
    `${dayKey}T00:00:00`,
  );

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

type DayGroup = {
  dayKey: string;
  items: TimelineItemType[];
};

function groupByDay(
  items: TimelineItemType[],
): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const item of items) {
    const dayKey = getDayKey(item.timestamp);
    const last = groups[groups.length - 1];

    if (last && last.dayKey === dayKey) {
      last.items.push(item);
    } else {
      groups.push({ dayKey, items: [item] });
    }
  }

  return groups;
}

type JournalTimelineProps = {
  onClose: () => void;
};

export function JournalTimeline({
  onClose,
}: JournalTimelineProps) {
  const [items, setItems] = useState<
    TimelineItemType[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] =
    useState(false);

  const loadTimeline = useCallback(async () => {
    setItems(await getTimeline());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await getTimeline();
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(
    () => groupByDay(items),
    [items],
  );

  async function handleAdd(text: string, mood?: JournalEntry["mood"]) {
    try {
      await addJournalEntry(text, mood);
      setComposerOpen(false);
      loadTimeline();
    } catch {
      showToast("Couldn't save journal entry");
    }
  }

  function handleDelete(item: TimelineItemType) {
    if (item.kind !== "journal") return;

    Alert.alert(
      "Delete this entry?",
      "This removes the journal note and can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteJournalEntry(item.id)
              .then(loadTimeline)
              .catch(() => {
                showToast("Couldn't delete entry");
              });
          },
        },
      ],
    );
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>
            Your timeline of activity
          </Text>
        </View>

        <Pressable
          onPress={() => setComposerOpen(true)}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add journal entry"
        >
          <Plus
            size={16}
            color={GymColors.text.primary}
          />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.body}>
          <SkeletonList count={6} height={72} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <BookOpenText
              size={32}
              color={GymColors.text.tertiary}
            />
          </View>

          <Text style={styles.emptyTitle}>
            No entries yet
          </Text>

          <Text style={styles.emptyText}>
            Your workouts, meals, measurements, and
            notes will appear here as a timeline.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View
              key={group.dayKey}
              style={styles.group}
            >
              <Text style={styles.dayLabel}>
                {formatDayLabel(group.dayKey)}
              </Text>

              <View style={styles.items}>
                {group.items.map((item) => (
                  <TimelineItem
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onDelete={
                      item.kind === "journal"
                        ? handleDelete
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <JournalSheet
        visible={composerOpen}
        onSave={handleAdd}
        onClose={() => setComposerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    height: "88%",
    paddingTop: Spacing.three,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },

  headerBlock: {
    gap: Spacing.half,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  subtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  addButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "700",
  },

  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },

  scrollContent: {
    gap: Spacing.four,
  },

  group: {
    gap: Spacing.two,
  },

  dayLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  items: {
    gap: Spacing.two,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.extraLarge,
    backgroundColor: GymColors.background.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.three,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "700",
    marginBottom: Spacing.two,
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});