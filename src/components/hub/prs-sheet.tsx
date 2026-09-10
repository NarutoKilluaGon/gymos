import { Trophy } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { EXERCISES } from "@/data/exercises";
import { getAllPRs } from "@/storage/repositories/prs";
import type { PersonalRecord } from "@/types/gymos";

const EMPTY: Record<string, PersonalRecord> = {};

function formatDate(iso: string): string {
  const date = new Date(iso);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exerciseName(exerciseId: string): string {
  return (
    EXERCISES.find((exercise) => exercise.id === exerciseId)?.name ??
    exerciseId
  );
}

type PersonalRecordsSheetProps = {
  onClose: () => void;
};

export function PersonalRecordsSheet({
  onClose,
}: PersonalRecordsSheetProps) {
  const [records, setRecords] =
    useState<Record<string, PersonalRecord>>(EMPTY);

  useEffect(() => {
    let mounted = true;

    getAllPRs()
      .then((loaded) => {
        if (mounted) {
          setRecords(loaded);
        }
      })
      .catch(() => {
        if (mounted) {
          setRecords(EMPTY);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sorted = Object.values(records).sort(
    (a, b) =>
      b.weight * b.reps -
      a.weight * a.reps,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Personal records</Text>

          <Text style={styles.subtitle}>
            Your best set for each exercise
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close personal records"
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
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Trophy size={40} color={GymColors.text.tertiary} />

            <Text style={styles.emptyTitle}>
              No personal records yet
            </Text>

            <Text style={styles.emptyBody}>
              When you log a set that beats your previous best, it&apos;ll
              show up here.
            </Text>
          </View>
        ) : (
          sorted.map((record) => (
            <View key={record.exerciseId} style={styles.row}>
              <View style={styles.iconContainer}>
                <Trophy size={20} color={GymColors.semantic.accent} />
              </View>

              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {exerciseName(record.exerciseId)}
                </Text>

                <Text style={styles.rowDate}>
                  {formatDate(record.timestamp)}
                </Text>
              </View>

              <Text style={styles.rowValue}>
                {record.weight} {record.unit} × {record.reps}
              </Text>
            </View>
          ))
        )}
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

  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  emptyBody: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "center",
    maxWidth: 260,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  rowMain: {
    flex: 1,
  },

  rowTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  rowDate: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  rowValue: {
    color: GymColors.semantic.accent,
    fontSize: Typography.body,
    fontWeight: "700",
  },
});