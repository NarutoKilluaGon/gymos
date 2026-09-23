import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ActiveWorkoutCard } from "@/components/workouts/active-workout-card";
import { CardioCard } from "@/components/workouts/cardio-card";
import { CardioSheet } from "@/components/workouts/cardio-sheet";
import { EmptyExercises } from "@/components/workouts/empty-exercises";
import { ExerciseCard } from "@/components/workouts/exercise-card";
import { ExercisePickerSheet } from "@/components/workouts/exercise-picker-sheet";
import { RoutineListSheet } from "@/components/workouts/routine-list-sheet";
import { SetInputSheet } from "@/components/workouts/set-input-sheet";
import { StartWorkoutCard } from "@/components/workouts/start-workout-card";
import { ModuleDisabled } from "@/components/ui/module-disabled";
import { useModules } from "@/contexts/modules-context";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { Dumbbell } from "lucide-react-native";
import { convertWeight } from "@/storage/repositories/preferences";
import {
  getPR,
  setPR,
} from "@/storage/repositories/prs";
import {
  addCardioToWorkout,
  addExerciseToWorkout,
  addSetToWorkoutExercise,
  finishWorkout,
  getTodayWorkouts,
  removeCardioFromWorkout,
  removeExerciseFromWorkout,
  removeSetFromWorkoutExercise,
  startWorkout,
} from "@/storage/repositories/workouts";
import type {
  CardioActivity,
  CardioEntry,
  PersonalRecord,
  Routine,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";
import { showToast } from "@/utils/toast";
import { useWeightUnit } from "@/hooks/use-weight-unit";

export default function WorkoutsScreen() {
  const { enabled } = useModules();
  const { unit: weightUnit } = useWeightUnit();

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [setExercise, setSetExercise] = useState<WorkoutExercise | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [savingSet, setSavingSet] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [routineListOpen, setRoutineListOpen] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [cardioActivity, setCardioActivity] = useState<CardioActivity>("running");
  const [customName, setCustomName] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioCalories, setCardioCalories] = useState("");
  const [savingCardio, setSavingCardio] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [setReference, setSetReference] = useState<{
    previousSet?: WorkoutSet;
    pr?: PersonalRecord | null;
  }>({});

  useEffect(() => {
    async function loadWorkout() {
      try {
        const workouts = await getTodayWorkouts();
        const active = workouts.find((w) => !w.endedAt) ?? null;
        setActiveWorkout(active);
      } catch {
        showToast("Couldn't load workout");
      }
    }
    loadWorkout();
  }, []);

  function handleStartWorkout() {
    if (activeWorkout) return;
    setRoutineListOpen(true);
  }

  async function handleStartFromRoutine(routine?: Routine) {
    if (starting || activeWorkout) return;
    setStarting(true);
    try {
      const workout = await startWorkout(
        routine?.name ?? "Workout",
        routine?.id,
      );

      for (const exercise of routine?.exercises ?? []) {
        await addExerciseToWorkout(
          workout.id,
          exercise.exerciseId,
          exercise.name,
        );
      }

      const workouts = await getTodayWorkouts();

      setActiveWorkout(
        workouts.find((item) => item.id === workout.id) ?? null,
      );

      setRoutineListOpen(false);
    } catch {
      showToast("Couldn't start workout");
    } finally {
      setStarting(false);
    }
  }

  async function handleAddExercise(exerciseId: string, name: string) {
    if (!activeWorkout || addingExercise) return;
    setAddingExercise(true);
    try {
      const exercise = await addExerciseToWorkout(activeWorkout.id, exerciseId, name);
      if (!exercise) return;
      setActiveWorkout((current) =>
        current ? { ...current, exercises: [...current.exercises, exercise] } : current,
      );
      setExercisePickerOpen(false);
    } catch {
      showToast("Couldn't add exercise");
    } finally {
      setAddingExercise(false);
    }
  }

  async function openSetSheet(exercise: WorkoutExercise) {
    setSetExercise(exercise);
    setWeight("");
    setReps("");

    try {
      const lastSet =
        exercise.sets.length > 0
          ? exercise.sets[exercise.sets.length - 1]
          : undefined;

      const pr = await getPR(exercise.exerciseId);

      setSetReference({ previousSet: lastSet, pr });
    } catch {
      setSetReference({});
    }
  }

  function closeSetSheet() {
    if (savingSet) return;
    setSetExercise(null);
    setWeight("");
    setReps("");
  }

  async function handleSaveSet() {
    if (!activeWorkout || !setExercise || savingSet) return;
    const weightValue = Number(weight);
    const repsValue = Number(reps);
    if (!Number.isFinite(weightValue) || weightValue <= 0 || !Number.isInteger(repsValue) || repsValue <= 0) return;

    setSavingSet(true);
    try {
      const savedSet = await addSetToWorkoutExercise(activeWorkout.id, setExercise.id, {
        reps: repsValue,
        weight: weightValue,
        unit: weightUnit,
        completed: true,
      });
      if (!savedSet) return;

      try {
        const prWeight = savedSet.weight ?? 0;
        const savedUnit = savedSet.unit ?? weightUnit;
        const currentPR = await getPR(setExercise.exerciseId);
        // PR records keep their own stored unit — convert the stored PR
        // weight into this set's unit before comparing volume.
        const prWeightComparable = currentPR
          ? convertWeight(currentPR.weight, currentPR.unit, savedUnit)
          : 0;
        const isNewPR =
          !currentPR ||
          prWeight * savedSet.reps > prWeightComparable * currentPR.reps;

        if (isNewPR) {
          await setPR({
            exerciseId: setExercise.exerciseId,
            weight: prWeight,
            reps: savedSet.reps,
            unit: savedSet.unit ?? weightUnit,
            timestamp: new Date().toISOString(),
          });

          showToast(
            `New PR! ${prWeight} ${weightUnit} × ${savedSet.reps} reps`,
            "success",
          );
        }
      } catch (error) {
        // PR bookkeeping is best-effort — never block the set save.
        console.error("Failed to track personal record", error);
      }

      setActiveWorkout((current) =>
        current
          ? {
              ...current,
              exercises: current.exercises.map((ex) =>
                ex.id === setExercise.id ? { ...ex, sets: [...ex.sets, savedSet] } : ex,
              ),
            }
          : current,
      );
      closeSetSheet();
    } catch {
      showToast("Couldn't save set");
    } finally {
      setSavingSet(false);
    }
  }

  function openCardioSheet() {
    setCardioActivity("running");
    setCustomName("");
    setCardioDuration("");
    setCardioDistance("");
    setCardioCalories("");
    setCardioOpen(true);
  }

  function closeCardioSheet() {
    if (savingCardio) return;
    setCardioOpen(false);
  }

  async function handleSaveCardio() {
    if (!activeWorkout || savingCardio || !cardioOpen) return;
    const durationValue = Number(cardioDuration);
    if (!Number.isInteger(durationValue) || durationValue <= 0) return;

    const distanceText = cardioDistance.trim();
    const distanceValue = distanceText ? Number(distanceText) : undefined;
    if (distanceText && (!Number.isFinite(distanceValue) || (distanceValue as number) <= 0)) return;

    const caloriesText = cardioCalories.trim();
    const caloriesValue = caloriesText ? Number(caloriesText) : undefined;
    if (caloriesText && (!Number.isInteger(caloriesValue) || (caloriesValue as number) < 0)) return;

    setSavingCardio(true);
    try {
      const entry = await addCardioToWorkout(activeWorkout.id, {
        activity: cardioActivity,
        ...(cardioActivity === "custom" && customName.trim()
          ? { name: customName.trim() }
          : {}),
        durationMin: durationValue,
        ...(distanceValue !== undefined ? { distanceKm: distanceValue } : {}),
        ...(caloriesValue !== undefined ? { calories: caloriesValue } : {}),
      });
      if (!entry) return;

      setActiveWorkout((current) =>
        current
          ? {
              ...current,
              cardio: [...(current.cardio ?? []), entry],
            }
          : current,
      );
      setCardioOpen(false);
    } catch {
      showToast("Couldn't save cardio");
    } finally {
      setSavingCardio(false);
    }
  }

  async function handleRemoveCardio(entry: CardioEntry) {
    if (!activeWorkout) return;
    try {
      await removeCardioFromWorkout(activeWorkout.id, entry.id);
      setActiveWorkout((current) =>
        current
          ? {
              ...current,
              cardio: (current.cardio ?? []).filter((item) => item.id !== entry.id),
            }
          : current,
      );
    } catch {
      showToast("Couldn't remove cardio");
    }
  }

  async function handleRemoveSet(exercise: WorkoutExercise, setId: string) {
    if (!activeWorkout) return;

    try {
      await removeSetFromWorkoutExercise(
        activeWorkout.id,
        exercise.id,
        setId,
      );

      setActiveWorkout((current) =>
        current
          ? {
              ...current,
              exercises: current.exercises.map((ex) =>
                ex.id === exercise.id
                  ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
                  : ex,
              ),
            }
          : current,
      );
    } catch {
      showToast("Couldn't remove set");
    }
  }

  function handleRemoveExercise(exercise: WorkoutExercise) {
    if (!activeWorkout) return;

    const setCount = exercise.sets.length;

    Alert.alert(
      "Remove exercise",
      setCount > 0
        ? `Remove ${exercise.name} and its ${setCount} ${
            setCount === 1 ? "set" : "sets"
          } from this workout?`
        : `Remove ${exercise.name} from this workout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeExerciseFromWorkout(
              activeWorkout.id,
              exercise.id,
            )
              .then(() => {
                setActiveWorkout((current) =>
                  current
                    ? {
                        ...current,
                        exercises: current.exercises.filter(
                          (ex) => ex.id !== exercise.id,
                        ),
                      }
                    : current,
                );
              })
              .catch(() => {
                showToast("Couldn't remove exercise");
              });
          },
        },
      ],
    );
  }

  async function handleFinishWorkout() {
    if (!activeWorkout || finishing) return;
    setFinishing(true);
    try {
      const notesText = workoutNotes.trim();
      const finished = await finishWorkout(
        activeWorkout.id,
        notesText || undefined,
      );

      // finishWorkout returns undefined when the session isn't in today's
      // store (e.g. it crossed midnight) — treat that as a failure rather
      // than report success for a workout that never actually ended.
      if (!finished) {
        showToast("Couldn't finish workout");
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActiveWorkout(null);
      setWorkoutNotes("");
    } catch {
      showToast("Couldn't finish workout");
    } finally {
      setFinishing(false);
    }
  }

  if (!enabled.workouts) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="workouts"
          title="Workouts"
          description="Track your training sessions, routines, and exercises."
          Icon={Dumbbell}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TRAINING</Text>
        <Text style={styles.title}>Workouts</Text>

        {!activeWorkout ? (
          <StartWorkoutCard starting={starting} onStart={handleStartWorkout} />
        ) : (
          <>
            <ActiveWorkoutCard workout={activeWorkout} />

            <View style={styles.exerciseHeader}>
              <Text style={styles.sectionTitle}>Exercises</Text>

              <Pressable
                onPress={() => setExercisePickerOpen(true)}
                style={styles.addButton}
                accessibilityRole="button"
                accessibilityLabel="Add exercise"
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>

            {activeWorkout.exercises.length === 0 ? (
              <EmptyExercises onAddExercise={() => setExercisePickerOpen(true)} />
            ) : (
              <View style={styles.exerciseList}>
                {activeWorkout.exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onAddSet={() => openSetSheet(exercise)}
                    onRemoveSet={(setId) =>
                      handleRemoveSet(exercise, setId)
                    }
                    onRemoveExercise={() =>
                      handleRemoveExercise(exercise)
                    }
                  />
                ))}
              </View>
            )}

            <View style={styles.exerciseHeader}>
              <Text style={styles.sectionTitle}>Cardio</Text>

              <Pressable
                onPress={openCardioSheet}
                style={styles.addButton}
                accessibilityRole="button"
                accessibilityLabel="Add cardio"
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>

            {(activeWorkout.cardio ?? []).length === 0 ? (
              <Text style={styles.emptyCardioText}>
                No cardio yet. Add a run, ride, or swim to this workout.
              </Text>
            ) : (
              <View style={styles.exerciseList}>
                {(activeWorkout.cardio ?? []).map((entry) => (
                  <CardioCard
                    key={entry.id}
                    entry={entry}
                    onDelete={() => handleRemoveCardio(entry)}
                  />
                ))}
              </View>
            )}

            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Notes</Text>

              <TextInput
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                placeholder="How did it go?"
                placeholderTextColor={GymColors.text.tertiary}
                multiline
                style={styles.notesInput}
              />
            </View>

            <Pressable
              onPress={handleFinishWorkout}
              disabled={finishing}
              style={[styles.finishButton, finishing && styles.finishButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Finish workout"
            >
              <Text style={styles.finishButtonText}>
                {finishing ? "Finishing..." : "Finish Workout"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal
        visible={exercisePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setExercisePickerOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} onPress={() => setExercisePickerOpen(false)} />
          <ExercisePickerSheet
            adding={addingExercise}
            onSelect={handleAddExercise}
            onClose={() => setExercisePickerOpen(false)}
          />
        </View>
      </Modal>

      <Modal
        visible={setExercise !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSetSheet}
      >
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} onPress={closeSetSheet} />
          {setExercise && (
            <SetInputSheet
              exercise={setExercise}
              weight={weight}
              reps={reps}
              unit={weightUnit}
              saving={savingSet}
              reference={setReference}
              onWeightChange={setWeight}
              onRepsChange={setReps}
              onSave={handleSaveSet}
              onClose={closeSetSheet}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={cardioOpen}
        transparent
        animationType="slide"
        onRequestClose={closeCardioSheet}
      >
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} onPress={closeCardioSheet} />
          <CardioSheet
            activity={cardioActivity}
            customName={customName}
            duration={cardioDuration}
            distance={cardioDistance}
            calories={cardioCalories}
            saving={savingCardio}
            onActivityChange={setCardioActivity}
            onCustomNameChange={setCustomName}
            onDurationChange={setCardioDuration}
            onDistanceChange={setCardioDistance}
            onCaloriesChange={setCardioCalories}
            onSave={handleSaveCardio}
            onClose={closeCardioSheet}
          />
        </View>
      </Modal>

      <RoutineListSheet
        visible={routineListOpen}
        starting={starting}
        onStart={handleStartFromRoutine}
        onClose={() => setRoutineListOpen(false)}
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

  exerciseHeader: {
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

  exerciseList: {
    gap: Spacing.two,
  },

  emptyCardioText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    lineHeight: 18,
  },

  notesSection: {
    marginTop: Spacing.four,
  },

  notesInput: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: Spacing.two,
  },

  finishButton: {
    marginTop: Spacing.five,
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  finishButtonDisabled: {
    opacity: 0.6,
  },

  finishButtonText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "700",
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
