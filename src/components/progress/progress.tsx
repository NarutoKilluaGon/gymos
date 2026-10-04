import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ExerciseProgressChart } from "@/components/progress/exercise-progress-chart";
import { MeasurementChart } from "@/components/progress/measurement-chart";
import { MeasurementSheet } from "@/components/quick-add/measurement-sheet";
import { MonthlySummaryCard } from "@/components/insights/monthly-summary";
import { GoalProgressCard } from "@/components/insights/goal-progress";
import { GymCard } from "@/components/ui/gym-card";
import { ModuleDisabled } from "@/components/ui/module-disabled";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { useModules } from "@/contexts/modules-context";
import {
  GymColors,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { deleteMeasurement, getMeasurementHistory } from "@/storage/repositories/measurements";
import {
  deleteProgressPhoto,
  getProgressPhotos,
} from "@/storage/repositories/progress-photos";
import {
  getExerciseHistory,
  getExercisesWithHistory,
  type ExercisePerformance,
  type ExerciseSummary,
} from "@/storage/repositories/workout-progress";
import { latestMeasurement } from "@/services/progress-chart";
import { pickAndSavePhotoFromLibrary } from "@/services/progress-photos";
import { getNorthStarProgress, getMonthlySummaries } from "@/services/insights";
import type {
  Measurement,
  MeasurementType,
  ProgressPhoto,
} from "@/types/gymos";
import { showToast } from "@/utils/toast";
import type { ProgressRange } from "@/types/progress";
import type { GoalProgress, MonthlySummary } from "@/types/insights";
import { LineChart } from "lucide-react-native";

type MeasurementConfig = {
  type: MeasurementType;
  label: string;
};

const MEASUREMENTS: MeasurementConfig[] = [
  {
    type: "weight",
    label: "Weight",
  },
  {
    type: "biceps",
    label: "Biceps",
  },
  {
    type: "chest",
    label: "Chest",
  },
  {
    type: "waist",
    label: "Waist",
  },
  {
    type: "thigh",
    label: "Thigh",
  },
];

const RANGES: ProgressRange[] = [
  "7D",
  "30D",
  "3M",
  "6M",
  "1Y",
  "ALL",
];

function getRangeStart(
  range: ProgressRange,
): number | null {
  if (range === "ALL") {
    return null;
  }

  const now = new Date();

  switch (range) {
    case "7D":
      now.setDate(now.getDate() - 7);
      break;

    case "30D":
      now.setDate(now.getDate() - 30);
      break;

    case "3M":
      now.setMonth(now.getMonth() - 3);
      break;

    case "6M":
      now.setMonth(now.getMonth() - 6);
      break;

    case "1Y":
      now.setFullYear(now.getFullYear() - 1);
      break;
  }

  return now.getTime();
}

function filterMeasurements(
  measurements: Measurement[],
  range: ProgressRange,
): Measurement[] {
  const start = getRangeStart(range);

  if (start === null) {
    return measurements;
  }

  return measurements.filter(
    (measurement) =>
      new Date(
        measurement.timestamp,
      ).getTime() >= start,
  );
}

function formatPhotoDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    [],
    { month: "short", day: "numeric" },
  );
}

export default function ProgressScreen() {
  const { enabled } = useModules();

  const [measurements, setMeasurements] =
    useState<Record<string, Measurement[]>>({});

  const [range, setRange] =
    useState<ProgressRange>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [measurementOpen, setMeasurementOpen] =
    useState(false);

  const [exercises, setExercises] = useState<
    ExerciseSummary[]
  >([]);

  const [chartHistory, setChartHistory] =
    useState<Record<string, ExercisePerformance[]>>(
      {},
    );

  const [selectedExercise, setSelectedExercise] =
    useState<string>("");

  const [photos, setPhotos] = useState<
    ProgressPhoto[]
  >([]);

  const [goalProgress, setGoalProgress] = useState<
    GoalProgress | null
  >(null);

  const [monthlies, setMonthlies] = useState<
    MonthlySummary[]
  >([]);

  const loadProgress = useCallback(async () => {
    try {
      const results = await Promise.all(
        MEASUREMENTS.map(async (item) => {
          const history =
            await getMeasurementHistory(
              item.type,
            );

          return [item.type, history] as const;
        }),
      );

      setMeasurements(
        Object.fromEntries(results),
      );

      const list = await getExercisesWithHistory();

      const histories =
        await Promise.all(
          list.map(async (item) => {
            const history =
              await getExerciseHistory(
                item.exerciseId,
              );

            return [
              item.exerciseId,
              history,
            ] as const;
          }),
        );

      setExercises(list);
      setChartHistory(
        Object.fromEntries(histories),
      );

      setPhotos(await getProgressPhotos());

      const [goal, summaries] = await Promise.all([
        getNorthStarProgress(),
        getMonthlySummaries(),
      ]);

      setGoalProgress(goal);
      setMonthlies(summaries);
    } catch {
      showToast("Couldn't load progress");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [loadProgress]),
  );

  async function handlePhotoAdd() {
    await pickAndSavePhotoFromLibrary();
    await loadProgress();
  }

  async function handlePhotoDelete(photo: ProgressPhoto) {
    Alert.alert(
      "Delete this photo?",
      "This removes the stored copy and can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteProgressPhoto(photo.id)
              .then(() => {
                setPhotos((current) =>
                  current.filter(
                    (item) => item.id !== photo.id,
                  ),
                );
              })
              .catch(() => {
                showToast("Couldn't delete photo");
              });
          },
        },
      ],
    );
  }

  function handleMeasurementDelete(
    item: MeasurementConfig,
  ) {
    const latest = latestMeasurement(
      measurements[item.type],
    );

    if (!latest) return;

    Alert.alert(
      "Delete latest measurement?",
      `Remove the most recent ${item.label} reading (${latest.value} ${latest.unit})? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMeasurement(latest.id)
              .then(loadProgress)
              .catch(() => {
                showToast(
                  "Couldn't delete measurement",
                );
              });
          },
        },
      ],
    );
  }

  const filteredMeasurements = useMemo(() => {
    const result: Record<
      string,
      Measurement[]
    > = {};

    for (const item of MEASUREMENTS) {
      result[item.type] =
        filterMeasurements(
          measurements[item.type] ?? [],
          range,
        );
    }

    return result;
  }, [measurements, range]);

  const latestMeasurements = useMemo(() => {
    const result: Record<
      string,
      Measurement | undefined
    > = {};

    for (const item of MEASUREMENTS) {
      result[item.type] = latestMeasurement(
        measurements[item.type],
      );
    }

    return result;
  }, [measurements]);

  const activeExerciseId = useMemo(() => {
    if (exercises.length === 0) {
      return null;
    }

    const stillPresent = exercises.find(
      (item) => item.exerciseId === selectedExercise,
    );

    return (
      stillPresent?.exerciseId ??
      exercises[0].exerciseId
    );
  }, [exercises, selectedExercise]);

  if (!enabled.progress) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="progress"
          title="Progress"
          description="See your measurement trends and how your body changes over time."
          Icon={LineChart}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Skeleton width="30%" height={14} />

          <Skeleton
            width="50%"
            height={32}
            style={styles.skeletonHeading}
          />

          <Skeleton
            height={120}
            style={styles.skeletonCard}
          />

          <Skeleton
            width="50%"
            height={14}
            style={styles.skeletonSection}
          />

          <SkeletonList
            count={3}
            height={140}
          />
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>
        PROGRESS
      </Text>

      <Text style={styles.heading}>
        Your progress
      </Text>

      {/* Goal progress */}
      <GoalProgressCard progress={goalProgress} />

      {/* Current snapshot */}
      <GymCard style={styles.snapshotCard}>
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotTitle}>
            Current snapshot
          </Text>

          <Pressable
            onPress={() => setMeasurementOpen(true)}
            style={styles.logButton}
            accessibilityRole="button"
            accessibilityLabel="Log a measurement"
          >
            <Text style={styles.logButtonText}>
              Log measurement
            </Text>
          </Pressable>
        </View>

        <View style={styles.snapshotGrid}>
          {MEASUREMENTS.map((item) => {
            const measurement =
              latestMeasurements[item.type];

            if (!measurement) {
              return (
                <View
                  key={item.type}
                  style={styles.snapshotItem}
                >
                  <Text style={styles.snapshotLabel}>
                    {item.label}
                  </Text>

                  <Text style={styles.snapshotEmpty}>
                    —
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={item.type}
                style={styles.snapshotItem}
              >
                <Text style={styles.snapshotLabel}>
                  {item.label}
                </Text>

                <Text style={styles.snapshotValue}>
                  {measurement.value}
                </Text>

                <Text style={styles.snapshotUnit}>
                  {measurement.unit}
                </Text>
              </View>
            );
          })}
        </View>
      </GymCard>

      <Text style={styles.sectionLabel}>
        TREND
      </Text>

      <View style={styles.rangeSelector}>
        {RANGES.map((item) => {
          const selected = item === range;

          return (
            <Pressable
              key={item}
              onPress={() => setRange(item)}
              style={[
                styles.rangeButton,
                selected &&
                  styles.rangeButtonSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${item} trend`}
            >
              <Text
                style={[
                  styles.rangeText,
                  selected &&
                    styles.rangeTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {MEASUREMENTS.map((item) => {
          const history =
            filteredMeasurements[item.type] ??
            [];

          const hasHistoricalData =
            (measurements[item.type] ?? [])
              .length > 0;

          return (
            <Pressable
              key={item.type}
              onLongPress={() =>
                handleMeasurementDelete(item)
              }
              accessibilityHint="Long press to delete the latest measurement"
            >
              <GymCard style={styles.card}>
                <Text style={styles.label}>
                  {item.label}
                </Text>

                <MeasurementChart
                  type={item.type}
                  measurements={history}
                  hasHistoricalData={
                    hasHistoricalData
                  }
                />
              </GymCard>
            </Pressable>
          );
        })}
      </View>

      <Text
        style={[
          styles.sectionLabel,
          styles.liftingLabel,
        ]}
      >
        LIFTING
      </Text>

      {exercises.length === 0 ? (
        <GymCard style={styles.card}>
          <Text style={styles.label}>
            Exercises
          </Text>

          <View style={styles.liftEmpty}>
            <Text style={styles.liftEmptyTitle}>
              No lifting history yet
            </Text>

            <Text style={styles.liftEmptySubtitle}>
              Finish a workout to see how each
              exercise improves over time.
            </Text>
          </View>
        </GymCard>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
          >
            {exercises.map((item) => {
              const selected =
                item.exerciseId ===
                activeExerciseId;

              return (
                <Pressable
                  key={item.exerciseId}
                  onPress={() =>
                    setSelectedExercise(
                      item.exerciseId,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${item.exerciseName} progress`}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected &&
                        styles.chipTextSelected,
                    ]}
                  >
                    {item.exerciseName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <GymCard style={styles.card}>
            <Text style={styles.label}>
              {
                exercises.find(
                  (item) =>
                    item.exerciseId ===
                    activeExerciseId,
                )?.exerciseName
              }
            </Text>

            <ExerciseProgressChart
              history={
                chartHistory[activeExerciseId ?? ""] ??
                []
              }
            />
          </GymCard>
        </>
      )}

      <Text
        style={[
          styles.sectionLabel,
          styles.liftingLabel,
        ]}
      >
        PHOTOS
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.photoStrip}
        contentContainerStyle={styles.photoStripContent}
      >
        <Pressable
          onPress={handlePhotoAdd}
          accessibilityRole="button"
          accessibilityLabel="Add a progress photo"
          style={styles.photoAdd}
        >
          <Text style={styles.photoAddIcon}>+</Text>

          <Text style={styles.photoAddText}>
            {photos.length === 0
              ? "Show your\nprogress"
              : "Add photo"}
          </Text>
        </Pressable>

        {photos.map((photo) => (
          <View
            key={photo.id}
            style={styles.photoTile}
          >
            <Image
              source={{ uri: photo.uri }}
              style={styles.photoImage}
              accessibilityLabel="Progress photo"
            />

            <Pressable
              onPress={() =>
                handlePhotoDelete(photo)
              }
              accessibilityRole="button"
              accessibilityLabel="Delete progress photo"
              style={styles.photoDelete}
            >
              <Text style={styles.photoDeleteText}>
                ×
              </Text>
            </Pressable>

            <Text style={styles.photoDate}>
              {formatPhotoDate(photo.date)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <GoalProgressCard progress={goalProgress} />

      {monthlies.length > 0 ? (
        <MonthlySummaryCard summaries={monthlies} />
      ) : null}
    </ScrollView>

    <MeasurementSheet
      visible={measurementOpen}
      onClose={() => setMeasurementOpen(false)}
      onSaved={loadProgress}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      GymColors.background.primary,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  skeletonHeading: {
    marginVertical: Spacing.two,
  },

  skeletonCard: {
    marginBottom: Spacing.four,
  },

  skeletonSection: {
    marginBottom: Spacing.two,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  heading: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  snapshotCard: {
    marginBottom: Spacing.four,
  },

  snapshotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  snapshotTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  logButton: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },

  logButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },

  snapshotItem: {
    width: "28%",
  },

  snapshotLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  snapshotValue: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "700",
  },

  snapshotUnit: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  snapshotEmpty: {
    color: GymColors.text.tertiary,
    fontSize: Typography.h2,
  },

  sectionLabel: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
  },

  rangeSelector: {
    flexDirection: "row",
    backgroundColor:
      GymColors.background.card,
    borderRadius: Radius.medium,
    padding: 4,
    marginBottom: Spacing.four,
  },

  rangeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
  },

  rangeButtonSelected: {
    backgroundColor:
      GymColors.background.surface,
  },

  rangeText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  rangeTextSelected: {
    color: GymColors.text.primary,
  },

  list: {
    gap: Spacing.two,
  },

  card: {
    marginBottom: 0,
  },

  label: {
    color: GymColors.text.primary,
    fontSize: Typography.h2,
    fontWeight: "600",
  },

  liftingLabel: {
    marginTop: Spacing.five,
  },

  chips: {
    marginBottom: Spacing.two,
  },

  chipsContent: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },

  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.card,
  },

  chipSelected: {
    backgroundColor: GymColors.semantic.accent,
  },

  chipText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  chipTextSelected: {
    color: GymColors.background.primary,
  },

  liftEmpty: {
    paddingVertical: Spacing.three,
  },

  liftEmptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  liftEmptySubtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
    lineHeight: 18,
  },

  photoStrip: {
    marginBottom: Spacing.one,
  },

  photoStripContent: {
    gap: Spacing.three,
    paddingRight: Spacing.four,
  },

  photoAdd: {
    width: 140,
    height: 160,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: GymColors.semantic.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },

  photoAddIcon: {
    color: GymColors.semantic.accent,
    fontSize: 32,
    fontWeight: "300",
  },

  photoAddText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  photoTile: {
    width: 140,
  },

  photoImage: {
    width: 140,
    height: 160,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.card,
  },

  photoDelete: {
    position: "absolute",
    top: Spacing.one,
    right: Spacing.one,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoDeleteText: {
    color: GymColors.text.primary,
    fontSize: 16,
    lineHeight: 18,
  },

  photoDate: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    textAlign: "center",
    marginTop: Spacing.one,
  },
});