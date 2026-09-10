import * as Haptics from "expo-haptics";
import { X, ArrowUp, ArrowDown, Plus, Copy, Archive } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ExercisePickerSheet } from "@/components/workouts/exercise-picker-sheet";
import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import {
  archiveRoutine,
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutines,
  updateRoutine,
} from "@/storage/repositories/routines";
import type { Routine, RoutineExercise } from "@/types/gymos";
import { showToast } from "@/utils/toast";

type RoutineListSheetProps = {
  visible: boolean;
  starting: boolean;
  /** Routine undefined → start a blank workout. */
  onStart: (routine?: Routine) => void;
  onClose: () => void;
};

type EditorState = {
  routine?: Routine;
  name: string;
  description: string;
  exercises: RoutineExercise[];
};

const EMPTY_EDITOR: EditorState = {
  name: "",
  description: "",
  exercises: [],
};

export function RoutineListSheet({
  visible,
  starting,
  onStart,
  onClose,
}: RoutineListSheetProps) {
  const [routines, setRoutines] = useState<Routine[]>([]);

  const [editor, setEditor] = useState<EditorState | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  const [confirmingDelete, setConfirmingDelete] =
    useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    getRoutines().then(setRoutines).catch(() => setRoutines([]));
  }, [visible]);

  function startEditor(routine?: Routine) {
    setEditor(
      routine
        ? {
            routine,
            name: routine.name,
            description: routine.description ?? "",
            exercises: routine.exercises
              .slice()
              .sort((a, b) => a.order - b.order),
          }
        : { ...EMPTY_EDITOR, exercises: [] },
    );
    setPickerOpen(false);
  }

  function handleClose() {
    if (saving) {
      return;
    }

    setEditor(null);
    setPickerOpen(false);
    setConfirmingDelete(null);
    onClose();
  }

  function addExercise(exerciseId: string, name: string) {
    if (!editor) {
      return;
    }

    if (editor.exercises.some((e) => e.exerciseId === exerciseId)) {
      setPickerOpen(false);
      return;
    }

    setEditor({
      ...editor,
      exercises: [
        ...editor.exercises,
        { exerciseId, name, order: editor.exercises.length },
      ],
    });

    setPickerOpen(false);
  }

  function removeExercise(exerciseId: string) {
    if (!editor) {
      return;
    }

    setEditor({
      ...editor,
      exercises: editor.exercises
        .filter((e) => e.exerciseId !== exerciseId)
        .map((e, index) => ({ ...e, order: index })),
    });
  }

  function moveExercise(exerciseId: string, delta: -1 | 1) {
    if (!editor) {
      return;
    }

    const index = editor.exercises.findIndex(
      (e) => e.exerciseId === exerciseId,
    );

    const target = index + delta;

    if (index < 0 || target < 0 || target >= editor.exercises.length) {
      return;
    }

    const exercises = [...editor.exercises];

    const [moved] = exercises.splice(index, 1);

    exercises.splice(target, 0, moved);

    setEditor({
      ...editor,
      exercises: exercises.map((e, i) => ({ ...e, order: i })),
    });
  }

  async function handleSave() {
    if (!editor || saving) {
      return;
    }

    const name = editor.name.trim();

    if (!name) {
      return;
    }

    setSaving(true);

    try {
      const exercises = editor.exercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((e, index) => ({ ...e, order: index }));

      if (editor.routine) {
        await updateRoutine(editor.routine.id, {
          name,
          description: editor.description || undefined,
          exercises,
        });
      } else {
        await createRoutine(name, editor.description || undefined, exercises);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );

      setEditor(null);
      setRoutines(await getRoutines());
    } catch {
      showToast("Couldn't save routine");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await deleteRoutine(id);
      setConfirmingDelete(null);
      setRoutines(await getRoutines());
    } catch {
      showToast("Couldn't delete routine");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(id: string) {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await duplicateRoutine(id);
      setRoutines(await getRoutines());
    } catch {
      showToast("Couldn't duplicate routine");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(id: string) {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await archiveRoutine(id);
      setRoutines(await getRoutines());
    } catch {
      showToast("Couldn't archive routine");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          {!editor ? (
            <RoutineList
              routines={routines}
              starting={starting}
              confirmingDelete={confirmingDelete}
              onStart={onStart}
              onCreate={() => startEditor()}
              onEdit={startEditor}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={(id) => {
                if (confirmingDelete === id) {
                  handleDelete(id);
                } else {
                  setConfirmingDelete(id);
                }
              }}
              onClose={handleClose}
            />
          ) : (
            <RoutineEditor
              editor={editor}
              saving={saving}
              onNameChange={(name) => setEditor({ ...editor, name })}
              onDescriptionChange={(description) =>
                setEditor({ ...editor, description })
              }
              onAddExercise={() => setPickerOpen(true)}
              onRemoveExercise={removeExercise}
              onMoveExercise={moveExercise}
              onSave={handleSave}
              onCancel={() => setEditor(null)}
              onClose={handleClose}
            />
          )}
        </View>

        {editor && pickerOpen && (
          <View style={styles.pickerModal}>
            <Pressable
              style={styles.backdrop}
              onPress={() => setPickerOpen(false)}
            />
            <ExercisePickerSheet
              adding={false}
              onSelect={addExercise}
              onClose={() => setPickerOpen(false)}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RoutineList({
  routines,
  starting,
  confirmingDelete,
  onStart,
  onCreate,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onClose,
}: {
  routines: Routine[];
  starting: boolean;
  confirmingDelete: string | null;
  onStart: (routine?: Routine) => void;
  onCreate: () => void;
  onEdit: (routine: Routine) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Routines</Text>

          <Text style={styles.subtitle}>
            Reusable templates for your sessions.
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close routines"
        >
          <X size={22} color={GymColors.text.secondary} />
        </Pressable>
      </View>

      {routines.length === 0 ? (
        <GymCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No routines yet</Text>

          <Text style={styles.emptyText}>
            Build a routine once, then start from it any day. Exercises are
            preloaded — you just log the sets.
          </Text>

          <Pressable
            onPress={onCreate}
            style={styles.createButton}
            accessibilityRole="button"
            accessibilityLabel="Create routine"
          >
            <Text style={styles.createButtonText}>Create Routine</Text>
          </Pressable>
        </GymCard>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.options}>
            {routines.map((routine) => {
              const confirming = confirmingDelete === routine.id;

              return (
                <View key={routine.id} style={styles.option}>
                  <View style={styles.optionHeader}>
                    <Pressable
                      disabled={starting}
                      onPress={() => onStart(routine)}
                      style={styles.startButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Start ${routine.name}`}
                    >
                      <Text style={styles.startButtonText}>
                        {starting ? "Starting..." : "Start"}
                      </Text>
                    </Pressable>

                    <View style={styles.optionContent}>
                      <Text style={styles.optionLabel}>{routine.name}</Text>

                      <Text style={styles.optionMeta}>
                        {routine.exercises.length}{" "}
                        {routine.exercises.length === 1
                          ? "exercise"
                          : "exercises"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.optionActions}>
                    <Pressable
                      onPress={() => onEdit(routine)}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${routine.name}`}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onDuplicate(routine.id)}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Duplicate ${routine.name}`}
                    >
                      <Copy
                        size={14}
                        color={GymColors.text.secondary}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>Duplicate</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onArchive(routine.id)}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Archive ${routine.name}`}
                    >
                      <Archive
                        size={14}
                        color={GymColors.text.secondary}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>Archive</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onDelete(routine.id)}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${routine.name}`}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          confirming && styles.deleteText,
                        ]}
                      >
                        {confirming ? "Confirm delete?" : "Delete"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={onCreate}
            style={styles.createButton}
            accessibilityRole="button"
            accessibilityLabel="New routine"
          >
            <Plus size={16} color={GymColors.text.primary} />
            <Text style={styles.createButtonText}>New Routine</Text>
          </Pressable>
        </ScrollView>
      )}
    </>
  );
}

function RoutineEditor({
  editor,
  saving,
  onNameChange,
  onDescriptionChange,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onSave,
  onCancel,
  onClose,
}: {
  editor: EditorState;
  saving: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onAddExercise: () => void;
  onRemoveExercise: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, delta: -1 | 1) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const canSave = editor.name.trim().length > 0;

  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {editor.routine ? "Edit Routine" : "New Routine"}
          </Text>

          <Text style={styles.subtitle}>
            {editor.routine
              ? `${editor.exercises.length} exercises selected.`
              : "Name it and pick the exercises."}
          </Text>
        </View>

        <Pressable
          onPress={onCancel}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Back to routines"
        >
          <X size={22} color={GymColors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.editorScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.inputLabel}>Name</Text>

        <TextInput
          value={editor.name}
          onChangeText={onNameChange}
          placeholder="e.g. Push Day"
          placeholderTextColor={GymColors.text.tertiary}
          style={styles.input}
        />

        <Text style={styles.inputLabel}>Description</Text>

        <TextInput
          value={editor.description}
          onChangeText={onDescriptionChange}
          placeholder="Optional — focus, goal, notes..."
          placeholderTextColor={GymColors.text.tertiary}
          multiline
          style={[styles.input, styles.descriptionInput]}
        />

        <View style={styles.exerciseHeader}>
          <Text style={styles.inputLabel}>Exercises</Text>

          <Pressable
            onPress={onAddExercise}
            style={styles.addExerciseButton}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <Plus size={14} color={GymColors.text.primary} />
            <Text style={styles.addExerciseText}>Add</Text>
          </Pressable>
        </View>

        {editor.exercises.length === 0 ? (
          <GymCard style={styles.exerciseEmpty}>
            <Text style={styles.exerciseEmptyText}>
              No exercises yet — add your first one.
            </Text>
          </GymCard>
        ) : (
          <View style={styles.exerciseOptions}>
            {editor.exercises.map((exercise, index) => {
              const first = index === 0;

              const last = index === editor.exercises.length - 1;

              return (
                <View key={exercise.exerciseId} style={styles.exerciseRow}>
                  <Text style={styles.exerciseOrder}>{index + 1}</Text>

                  <Text style={styles.exerciseName}>{exercise.name}</Text>

                  <Pressable
                    disabled={first}
                    onPress={() => onMoveExercise(exercise.exerciseId, -1)}
                    style={[
                      styles.moveButton,
                      first && styles.moveButtonDisabled,
                    ]}
                    accessibilityLabel={`Move ${exercise.name} up`}
                  >
                    <ArrowUp
                      size={16}
                      color={
                        first
                          ? GymColors.text.disabled
                          : GymColors.text.secondary
                      }
                    />
                  </Pressable>

                  <Pressable
                    disabled={last}
                    onPress={() => onMoveExercise(exercise.exerciseId, 1)}
                    style={[
                      styles.moveButton,
                      last && styles.moveButtonDisabled,
                    ]}
                    accessibilityLabel={`Move ${exercise.name} down`}
                  >
                    <ArrowDown
                      size={16}
                      color={
                        last
                          ? GymColors.text.disabled
                          : GymColors.text.secondary
                      }
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => onRemoveExercise(exercise.exerciseId)}
                    style={styles.removeButton}
                    accessibilityLabel={`Remove ${exercise.name}`}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={onSave}
          disabled={!canSave || saving}
          style={[
            styles.saveButton,
            (!canSave || saving) && styles.saveButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${saving ? "Saving" : "Save"} routine`}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Routine"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },

  sheet: {
    backgroundColor: GymColors.background.surface,
    borderTopLeftRadius: Radius.extraLarge,
    borderTopRightRadius: Radius.extraLarge,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },

  pickerModal: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    gap: Spacing.two,
  },

  emptyTitle: {
    color: GymColors.text.primary,
    fontSize: Typography.h3,
    fontWeight: "600",
  },

  emptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
    lineHeight: 22,
  },

  scroll: {
    maxHeight: 480,
  },

  options: {
    gap: Spacing.two,
  },

  option: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },

  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  optionContent: {
    flex: 1,
  },

  optionLabel: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  optionMeta: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginTop: Spacing.one,
  },

  startButton: {
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  startButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.caption,
    fontWeight: "700",
  },

  optionActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  actionIcon: {
    marginRight: 4,
  },

  actionText: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  deleteText: {
    color: GymColors.semantic.error,
  },

  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    marginTop: Spacing.three,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
  },

  createButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  editorScroll: {
    maxHeight: 520,
  },

  inputLabel: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },

  input: {
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  descriptionInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },

  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },

  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  addExerciseText: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  exerciseEmpty: {
    marginTop: Spacing.one,
  },

  exerciseEmptyText: {
    color: GymColors.text.secondary,
    fontSize: Typography.body,
  },

  exerciseOptions: {
    gap: Spacing.two,
  },

  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GymColors.background.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },

  exerciseOrder: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    fontWeight: "600",
    width: 18,
  },

  exerciseName: {
    flex: 1,
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "500",
  },

  moveButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  moveButtonDisabled: {
    opacity: 0.4,
  },

  removeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  removeText: {
    color: GymColors.semantic.error,
    fontSize: 22,
    fontWeight: "300",
  },

  saveButton: {
    marginTop: Spacing.four,
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonText: {
    color: GymColors.background.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});