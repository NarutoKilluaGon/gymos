import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomBar } from "@/components/workouts/bottom-bar";
import { ExerciseCard } from "@/components/workouts/exercise-card";
import {
  DraftScope,
  createDraftRegistry,
} from "@/components/workouts/number-field";
import {
  ExerciseMenuSheet,
  ExercisePickerSheet,
  FinishSheet,
  NoteSheet,
  PlatesSheet,
  RepTargetSheet,
  SummarySheet,
  WorkoutMenuSheet,
} from "@/components/workouts/forge-sheets";
import { FCard, fmtInt, tap } from "@/components/workouts/forge-ui";
import { SessionHeader } from "@/components/workouts/session-header";
import { SummaryStrip } from "@/components/workouts/summary-strip";
import { Screen } from "@/components/ds/screen";
import { F } from "@/constants/forge-theme";
import { useLiveSession, type ForgeData } from "@/hooks/use-forge";
import {
  addSet,
  appendExercise,
  isSupersetLeader,
  moveExerciseUp,
  reinsertExercise,
  reinsertSet,
  removeExercise,
  removeSet,
  setCounts,
  setNote,
  setSetValues,
  swapExercise,
  toggleFailure,
  toggleSet,
  toggleSuperset,
  toggleWarmup,
} from "@/services/forge/ops";
import {
  fromKg,
  round1,
  sessionVolumeKg,
} from "@/services/forge/load";
import { previousSets } from "@/services/forge/history";
import { exerciseForSession } from "@/services/forge/start";
import {
  durationMs,
  formatClock,
  IDLE_LIMIT_MS,
  pause,
  resume,
} from "@/services/forge/timing";
import type { CatalogExercise } from "@/types/forge";
import type { SessionPr, WorkoutSession } from "@/types/gymos";
import { showUndoToast } from "@/utils/toast";

export {
  createDraftRegistry,
  DraftScope,
  NumberField,
  DraftTextField,
  type DraftRegistry,
} from "./number-field";

function setValuesById(
  session: WorkoutSession,
  exerciseId: string,
  setId: string,
  values: { weight?: number; reps?: number },
): WorkoutSession {
  const exerciseIndex = session.exercises.findIndex((entry) => entry.id === exerciseId);
  const setIndex =
    session.exercises[exerciseIndex]?.sets.findIndex((entry) => entry.id === setId) ?? -1;

  return exerciseIndex < 0 || setIndex < 0
    ? session
    : setSetValues(session, exerciseIndex, setIndex, values, new Date());
}

type SheetState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "swap"; index: number }
  | { kind: "note"; index: number }
  | { kind: "targetReps"; index: number }
  | { kind: "plates"; index: number }
  | { kind: "exerciseMenu"; index: number }
  | { kind: "workoutMenu" }
  | { kind: "finish" };

export function ForgeSession({
  initial,
  data,
  unit,
  onClose,
  onDelete,
  onRestore,
  onCreateExercise,
  onChanged,
  flushRef,
}: {
  initial: WorkoutSession;
  data: ForgeData;
  unit: "kg" | "lb";
  onClose: () => void;
  onDelete: (id: string) => Promise<boolean>;
  onRestore?: (session: WorkoutSession) => Promise<boolean>;
  onCreateExercise: (
    name: string,
    muscle: CatalogExercise["muscleGroup"],
    bodyweight: boolean,
  ) => Promise<CatalogExercise | null>;
  onChanged: () => void;
  flushRef: RefObject<(() => Promise<void>) | null>;
}) {
  const { session, update, complete, reopenSession, flush } = useLiveSession(
    initial,
    data.sessions,
    unit,
  );
  const [drafts] = useState(createDraftRegistry);
  const [sheet, setSheet] = useState<SheetState>({ kind: "none" });
  const [now, setNow] = useState(() => Date.now());
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    prs: SessionPr[];
    trimmed: boolean;
  } | null>(null);

  const finished = Boolean(session.endedAt);
  const paused = Boolean(session.pausedAt);

  const flushAll = useCallback(async () => {
    drafts.flushAll();
    await flush();
  }, [drafts, flush]);

  useEffect(() => {
    flushRef.current = flushAll;

    return () => {
      if (flushRef.current === flushAll) flushRef.current = null;
    };
  }, [flushAll, flushRef]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const restDone = restEnd !== null && now >= restEnd;

  useEffect(() => {
    if (restDone) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [restDone]);

  const names = useMemo(() => {
    const out: Record<string, string> = {};

    for (const exercise of session.exercises) {
      out[exercise.exerciseId] = exercise.name;
    }

    return out;
  }, [session.exercises]);

  const counts = setCounts(session);
  const restLeft = restEnd === null ? 0 : Math.max(0, Math.ceil((restEnd - now) / 1000));
  const rest = data.settings.restSeconds;

  const tick = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      const at = new Date();
      let startRest = false;

      update((current) => {
        const result = toggleSet(current, exerciseIndex, setIndex, at);
        startRest = result.startRest;
        return result.session;
      });

      if (startRest && rest > 0) setRestEnd(Date.now() + rest * 1000);
      else setRestEnd(null);
    },
    [rest, update],
  );

  const finishing = useRef(false);

  useEffect(() => {
    if (!finished) finishing.current = false;
  }, [finished]);

  const finishWith = async (mode: "keep" | "complete" | "drop") => {
    if (finishing.current) return;

    finishing.current = true;
    drafts.flushAll();
    setSheet({ kind: "none" });

    if (mode !== "keep") {
      update((current) => {
        const exercises = current.exercises
          .map((exercise) => ({
            ...exercise,
            sets:
              mode === "complete"
                ? exercise.sets.map((set) => ({ ...set, completed: true }))
                : exercise.sets.filter((set) => set.completed),
          }))
          .filter((exercise) => exercise.sets.length > 0);

        return { ...current, exercises };
      });
    }

    let result: Awaited<ReturnType<typeof complete>>;

    try {
      result = await complete();
    } catch {
      finishing.current = false;
      return;
    }

    setRestEnd(null);
    setSummary({ prs: result.session.prs ?? [], trimmed: result.trimmed });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChanged();
  };

  const addExercise = (exercise: CatalogExercise) => {
    const built = exerciseForSession({
      exercise,
      sessions: data.sessions,
      session,
      unit,
    });

    update((current) => appendExercise(current, built, new Date()));
  };

  const swapWith = (index: number, exercise: CatalogExercise) => {
    update((current) =>
      swapExercise(
        current,
        index,
        {
          exerciseId: exercise.id,
          name: exercise.name,
          bodyweight: exercise.bodyweight,
          ...(exercise.how ? { tip: exercise.how.split(".")[0] ?? "" } : {}),
        },
        new Date(),
      ),
    );
  };

  // Idle session detection (stale for 30+ min)
  const lastActiveMs = session.lastActivityAt
    ? new Date(session.lastActivityAt).getTime()
    : new Date(session.startedAt).getTime();
  const isIdle =
    !finished &&
    !paused &&
    !session.backdated &&
    now - lastActiveMs > IDLE_LIMIT_MS;
  const idleDuration = isIdle ? formatClock(now - lastActiveMs) : undefined;

  const clock = formatClock(durationMs(session, now));
  const exerciseSheet =
    sheet.kind === "note" || sheet.kind === "exerciseMenu"
      ? session.exercises[sheet.index]
      : undefined;
  const platesExercise = sheet.kind === "plates" ? session.exercises[sheet.index] : undefined;
  const platesWeight = platesExercise
    ? (platesExercise.sets.find((set) => !set.warmup && set.completed) ??
      platesExercise.sets.find((set) => !set.warmup))
    : undefined;

  return (
    <DraftScope value={drafts}>
      <Screen scroll={false} style={styles.root}>
        {/* 1. TOP HEADER (56 dp) */}
        <SessionHeader
          name={session.name}
          onNameChange={(name) => update((current) => ({ ...current, name }))}
          onClose={() => {
            tap();
            onClose();
          }}
          onOptionsPress={() => setSheet({ kind: "workoutMenu" })}
        />

        {/* 2. SUMMARY STRIP (sticky) */}
        <SummaryStrip
          clock={clock}
          paused={paused}
          backdated={session.backdated}
          disabled={finished || session.backdated}
          isIdle={isIdle}
          idleDuration={idleDuration}
          setsDone={counts.done}
          setsTotal={counts.total}
          volumeLabel={`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit}`}
          onToggleClock={() => {
            update((current) =>
              current.pausedAt ? resume(current, new Date()) : pause(current, new Date()),
            );
          }}
          onResumeIdle={() => {
            update((current) => ({ ...current, lastActivityAt: new Date().toISOString() }));
          }}
          onFinishIdle={() => setSheet({ kind: "finish" })}
        />

        {/* 3. SCROLLABLE EXERCISE CARDS */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {finished ? (
            <FCard style={styles.stats}>
              <View style={styles.statRow}>
                <View>
                  <Text style={styles.meta}>Volume</Text>
                  <Text style={styles.statValue}>
                    {`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit}`}
                  </Text>
                </View>
                <View>
                  <Text style={styles.meta}>Sets</Text>
                  <Text style={styles.statValue}>{String(counts.done)}</Text>
                </View>
              </View>
              {(session.prs ?? []).map((pr) => (
                <View key={pr.exerciseId} style={styles.prRow}>
                  <Text style={styles.exName}>{names[pr.exerciseId] ?? pr.exerciseId}</Text>
                  <Text style={styles.pr}>
                    {`PR ${round1(pr.weight)} ${pr.unit}×${pr.reps}`}
                  </Text>
                </View>
              ))}
            </FCard>
          ) : null}

          {session.exercises.map((exercise, index) => {
            const previous = previousSets(data.sessions, exercise.exerciseId, session);
            const linkedAbove =
              session.exercises[index - 1]?.group === exercise.group &&
              Boolean(exercise.group);
            const linkedBelow = isSupersetLeader(session, index);

            return (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseIndex={index}
                unit={unit}
                previous={previous}
                isLinkedAbove={linkedAbove}
                isLinkedBelow={linkedBelow}
                onOptionsPress={() => setSheet({ kind: "exerciseMenu", index })}
                onAddSet={() => update((current) => addSet(current, index, new Date()))}
                onToggleWarmup={(setIndex) =>
                  update((current) => toggleWarmup(current, index, setIndex, new Date()))
                }
                onToggleFailure={(setIndex) =>
                  update((current) => toggleFailure(current, index, setIndex, new Date()))
                }
                onRemoveSet={(setIndex) => {
                  const targetExercise = exercise;
                  const targetSet = targetExercise.sets[setIndex];
                  if (!targetSet) return;
                  update((current) => {
                    const curIdx = current.exercises.findIndex((e) => e.id === targetExercise.id);
                    return curIdx >= 0 ? removeSet(current, curIdx, setIndex, new Date()) : current;
                  });
                  showUndoToast({
                    message: "Set removed",
                    onUndo: () => {
                      update((current) => {
                        const curIdx = current.exercises.findIndex((e) => e.id === targetExercise.id);
                        return curIdx >= 0
                          ? reinsertSet(current, curIdx, setIndex, targetSet, new Date())
                          : current;
                      });
                    },
                  });
                }}
                onWeightCommit={(setIndex, setId, weight) =>
                  update((current) => setValuesById(current, exercise.id, setId, { weight }))
                }
                onRepsCommit={(setIndex, setId, reps) =>
                  update((current) => setValuesById(current, exercise.id, setId, { reps }))
                }
                onToggleDone={(setIndex) => tick(index, setIndex)}
              />
            );
          })}

          {/* Quiet dashed full-width Add exercise row */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
            onPress={() => {
              tap();
              setSheet({ kind: "add" });
            }}
            style={styles.addExerciseButton}
          >
            <Plus size={18} color={F.acc} />
            <Text style={styles.addExerciseText}>Add exercise</Text>
          </Pressable>

          {session.notes ? <Text style={styles.sessionNotes}>{session.notes}</Text> : null}
        </ScrollView>

        {/* 4. DOCKED BOTTOM BAR (Finish / Reopen & Rest timer) */}
        <BottomBar
          finished={finished}
          counts={counts}
          restLeft={restLeft}
          onFinishPress={() => setSheet({ kind: "finish" })}
          onReopenPress={() => reopenSession()}
          onAddRestSeconds={(seconds) => setRestEnd((val) => (val ?? Date.now()) + seconds * 1000)}
          onSkipRest={() => setRestEnd(null)}
        />

        {/* 5. SHEETS */}
        <ExercisePickerSheet
          visible={sheet.kind === "add" || sheet.kind === "swap"}
          title={sheet.kind === "swap" ? "Swap exercise" : "Add exercise"}
          catalog={data.catalog}
          onClose={() => setSheet({ kind: "none" })}
          onCreate={onCreateExercise}
          onPick={(exercise) => {
            if (sheet.kind === "swap") swapWith(sheet.index, exercise);
            else addExercise(exercise);
          }}
        />

        <NoteSheet
          key={sheet.kind === "note" ? `note-${sheet.index}` : "note-closed"}
          visible={sheet.kind === "note"}
          onClose={() => setSheet({ kind: "none" })}
          title={
            sheet.kind === "note" && sheet.index >= 0
              ? (exerciseSheet?.name ?? "Note")
              : "Workout note"
          }
          initial={
            sheet.kind === "note"
              ? sheet.index >= 0
                ? (exerciseSheet?.note ?? "")
                : (session.notes ?? "")
              : ""
          }
          onSave={(note) =>
            update((current) =>
              setNote(current, sheet.kind === "note" ? sheet.index : -1, note, new Date()),
            )
          }
        />

        {RepTargetSheet ? (
          <RepTargetSheet
            key={sheet.kind === "targetReps" ? `reps-${sheet.index}` : "reps-closed"}
            visible={sheet.kind === "targetReps"}
            onClose={() => setSheet({ kind: "none" })}
            title={exerciseSheet?.name ?? "Exercise"}
            initial={exerciseSheet?.repTarget ?? ""}
            onSave={(target) => {
              if (sheet.kind === "targetReps") {
                const idx = sheet.index;
                update((current) => {
                  const exercises = current.exercises.map((ex, i) =>
                    i === idx ? { ...ex, repTarget: target || undefined } : ex,
                  );
                  return { ...current, exercises };
                });
              }
            }}
          />
        ) : null}

        <PlatesSheet
          visible={sheet.kind === "plates"}
          onClose={() => setSheet({ kind: "none" })}
          weight={platesWeight?.weight ?? 0}
          unit={platesWeight?.unit ?? unit}
          barKg={data.settings.barKg}
        />

        {ExerciseMenuSheet ? (
          <ExerciseMenuSheet
            visible={sheet.kind === "exerciseMenu"}
            onClose={() => setSheet({ kind: "none" })}
            exerciseName={exerciseSheet?.name ?? "Exercise options"}
            isBodyweight={exerciseSheet?.bodyweight}
            isSuperset={
              sheet.kind === "exerciseMenu"
                ? isSupersetLeader(session, sheet.index)
                : false
            }
            canMoveUp={sheet.kind === "exerciseMenu" && sheet.index > 0}
            canMoveDown={
              sheet.kind === "exerciseMenu" &&
              sheet.index < session.exercises.length - 1
            }
            onNote={() => {
              if (sheet.kind === "exerciseMenu") {
                const idx = sheet.index;
                setSheet({ kind: "note", index: idx });
              }
            }}
            onTargetReps={() => {
              if (sheet.kind === "exerciseMenu") {
                const idx = sheet.index;
                setSheet({ kind: "targetReps", index: idx });
              }
            }}
            onSwap={() => {
              if (sheet.kind === "exerciseMenu") {
                const idx = sheet.index;
                setSheet({ kind: "swap", index: idx });
              }
            }}
            onPlates={() => {
              if (sheet.kind === "exerciseMenu") {
                const idx = sheet.index;
                setSheet({ kind: "plates", index: idx });
              }
            }}
            onToggleSuperset={() => {
              if (sheet.kind === "exerciseMenu") {
                update((current) => toggleSuperset(current, sheet.index, new Date()));
              }
            }}
            onMoveUp={() => {
              if (sheet.kind === "exerciseMenu") {
                update((current) => moveExerciseUp(current, sheet.index, new Date()));
              }
            }}
            onMoveDown={() => {
              if (sheet.kind === "exerciseMenu") {
                // Move down is swap with index + 1
                const idx = sheet.index;
                update((current) => moveExerciseUp(current, idx + 1, new Date()));
              }
            }}
            onRemove={() => {
              if (sheet.kind === "exerciseMenu") {
                const targetIndex = sheet.index;
                const targetExercise = session.exercises[targetIndex];
                setSheet({ kind: "none" });
                if (!targetExercise) return;
                update((current) => removeExercise(current, targetIndex, new Date()));
                showUndoToast({
                  message: `${targetExercise.name} removed`,
                  onUndo: () => {
                    update((current) =>
                      reinsertExercise(current, targetIndex, targetExercise, new Date()),
                    );
                  },
                });
              }
            }}
          />
        ) : null}

        {WorkoutMenuSheet ? (
          <WorkoutMenuSheet
            visible={sheet.kind === "workoutMenu"}
            onClose={() => setSheet({ kind: "none" })}
            paused={paused}
            onToggleClock={() => {
              update((current) =>
                current.pausedAt ? resume(current, new Date()) : pause(current, new Date()),
              );
            }}
            onNote={() => setSheet({ kind: "note", index: -1 })}
            onDelete={() => {
              setSheet({ kind: "none" });
              drafts.flushAll();
              const sessionToDelete = session;
              void flush()
                .then(() => onDelete(sessionToDelete.id))
                .then((ok) => {
                  if (ok) {
                    onClose();
                    showUndoToast({
                      message: "Workout deleted",
                      onUndo: () => {
                        if (onRestore) {
                          void onRestore(sessionToDelete);
                        }
                      },
                    });
                  }
                });
            }}
          />
        ) : null}

        <FinishSheet
          visible={sheet.kind === "finish"}
          onClose={() => setSheet({ kind: "none" })}
          open={counts.total - counts.done}
          onFinish={(mode) => void finishWith(mode)}
        />

        <SummarySheet
          visible={summary !== null}
          onClose={() => setSummary(null)}
          durationLabel={formatClock(durationMs(session, now))}
          volumeLabel={`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit}`}
          sets={counts.done}
          prs={summary?.prs ?? []}
          names={names}
          trimmed={summary?.trimmed ?? false}
          formatPr={(pr) => `${round1(pr.weight)} ${pr.unit}×${pr.reps}`}
        />
      </Screen>
    </DraftScope>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: F.bg,
  },
  numberInput: {
    width: 68,
    height: 48,
    borderRadius: 14,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    color: F.ink,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  stats: {
    marginTop: 8,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: "row",
    gap: 32,
  },
  meta: {
    color: F.mute,
    fontSize: 13,
  },
  statValue: {
    color: F.ink,
    fontSize: 24,
    fontWeight: "300",
  },
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 12,
  },
  pr: {
    color: F.acc,
    fontWeight: "600",
    fontSize: 14,
  },
  exName: {
    color: F.ink,
    fontSize: 16,
    flexShrink: 1,
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderStyle: "dashed",
    marginTop: 20,
    marginBottom: 16,
  },
  addExerciseText: {
    fontSize: 15,
    fontWeight: "600",
    color: F.acc,
  },
  sessionNotes: {
    color: F.mute,
    fontSize: 14,
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: F.line,
  },
});
