import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
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
  TextInput,
  View,
} from "react-native";

import {
  ConfirmSheet,
  ExercisePickerSheet,
  FinishSheet,
  NoteSheet,
  PlatesSheet,
  SummarySheet,
} from "@/components/workouts/forge-sheets";
import { Button, FCard, fmtInt, tap } from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import { useLiveSession, type ForgeData } from "@/hooks/use-forge";
import { exerciseForSession } from "@/services/forge/start";
import {
  addSet,
  appendExercise,
  isSupersetLeader,
  moveExerciseUp,
  removeExercise,
  removeSet,
  setCounts,
  setNote,
  setSetValues,
  swapExercise,
  toggleSet,
  toggleSuperset,
  toggleWarmup,
} from "@/services/forge/ops";
import { formatSets, round1, sessionVolumeKg, fromKg } from "@/services/forge/load";
import { previousSets } from "@/services/forge/history";
import { durationMs, formatClock, pause, resume } from "@/services/forge/timing";
import type { CatalogExercise } from "@/types/forge";
import type { SessionPr, WorkoutSession } from "@/types/gymos";

/**
 * The NumberFields on a screen register here so the screen can commit every
 * pending draft synchronously (before it flushes or finishes), instead of
 * waiting for a blur or an unmount that may come too late.
 */
export type DraftRegistry = {
  register: (commit: () => void) => () => void;
  flushAll: () => void;
};

export function createDraftRegistry(): DraftRegistry {
  const fields = new Set<() => void>();

  return {
    register: (commit) => {
      fields.add(commit);

      return () => {
        fields.delete(commit);
      };
    },
    flushAll: () => {
      for (const commit of [...fields]) commit();
    },
  };
}

const DraftContext = createContext<DraftRegistry | null>(null);

export const DraftScope = DraftContext.Provider;

/** Number input that keeps what you type and commits when you leave it, or
 *  when its screen asks for pending drafts to be flushed. */
export function NumberField({
  value,
  placeholder,
  decimal,
  label,
  onCommit,
}: {
  value: number | undefined;
  placeholder: string;
  decimal?: boolean;
  label: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // The ref is the source of truth for "is there a pending draft": it is
  // read by flush/blur/unmount, which can run before a re-render.
  const draftRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const decimalRef = useRef(decimal);
  const registry = useContext(DraftContext);
  const shown = draft ?? (value ? String(round1(value)) : "");

  useEffect(() => {
    onCommitRef.current = onCommit;
    decimalRef.current = decimal;
  });

  // Clears the draft before committing, so a blur, an endEditing and a
  // flush that all land for the same draft commit it exactly once.
  const commit = useCallback(() => {
    const text = draftRef.current;

    if (text === null) return;

    draftRef.current = null;
    setDraft(null);

    const parsed = Number(text.replace(",", "."));

    if (text.trim() === "") {
      onCommitRef.current(0);
    } else if (Number.isFinite(parsed)) {
      onCommitRef.current(decimalRef.current ? parsed : Math.max(0, Math.round(parsed)));
    }
  }, []);

  useEffect(() => registry?.register(commit), [registry, commit]);

  // Final safety net. Consumers commit by identity (not position), so a
  // field whose row was removed commits to nothing.
  useEffect(() => commit, [commit]);

  return (
    <TextInput
      accessibilityLabel={label}
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={F.dim}
      selectionColor={F.acc}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      onChangeText={(text) => {
        draftRef.current = text;
        setDraft(text);
      }}
      onBlur={commit}
      onEndEditing={commit}
      selectTextOnFocus
      style={s.input}
    />
  );
}

/** Set a set's values by id. A set that is gone (removed while its field was
 *  focused) is a no-op, so a stale draft can't land on a neighbour. */
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
  | { kind: "plates"; index: number }
  | { kind: "finish" }
  | { kind: "delete" };

export function ForgeSession({
  initial,
  data,
  unit,
  onClose,
  onDelete,
  onCreateExercise,
  onChanged,
  flushRef,
}: {
  initial: WorkoutSession;
  data: ForgeData;
  unit: "kg" | "lb";
  onClose: () => void;
  onDelete: (id: string) => Promise<boolean>;
  onCreateExercise: (
    name: string,
    muscle: CatalogExercise["muscleGroup"],
    bodyweight: boolean,
  ) => Promise<CatalogExercise | null>;
  /** The saved data changed; the parent should reload. */
  onChanged: () => void;
  /** Filled with this session's save-queue flush so the parent can await it. */
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

  // What the parent awaits before leaving: commit typed-but-uncommitted
  // fields into the session first, then drain the save queue.
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
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (restEnd !== null && now >= restEnd) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestEnd(null);
    }
  }, [now, restEnd]);

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

  const tick = (exerciseIndex: number, setIndex: number) => {
    const at = new Date();
    let startRest = false;

    update((current) => {
      const result = toggleSet(current, exerciseIndex, setIndex, at);

      startRest = result.startRest;

      return result.session;
    });

    if (startRest && rest > 0) setRestEnd(Date.now() + rest * 1000);
    else setRestEnd(null);
  };

  const finishWith = async (mode: "keep" | "complete" | "drop") => {
    // Typed values must be in the session before it is finished and judged.
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

    const result = await complete();

    setRestEnd(null);
    setSummary({ prs: result.session.prs ?? [], trimmed: result.trimmed });
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

  const clock = formatClock(durationMs(session, now));
  const exerciseSheet = sheet.kind === "note" ? session.exercises[sheet.index] : undefined;
  const platesExercise = sheet.kind === "plates" ? session.exercises[sheet.index] : undefined;
  const platesWeight = platesExercise
    ? (platesExercise.sets.find((set) => !set.warmup && set.completed) ??
      platesExercise.sets.find((set) => !set.warmup))
    : undefined;

  return (
    <DraftScope value={drafts}>
    <View style={s.root}>
      <View style={s.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { tap(); onClose(); }} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? "Resume clock" : "Pause clock"}
          disabled={finished || session.backdated}
          onPress={() => {
            tap();
            update((current) =>
              current.pausedAt ? resume(current, new Date()) : pause(current, new Date()),
            );
          }}
        >
          <Text style={[s.clock, paused && { color: F.warm }]}>
            {session.backdated ? "Logged" : paused ? `${clock} · paused` : clock}
          </Text>
        </Pressable>
        {finished ? (
          <Button kind="ghost" label="Reopen" onPress={() => reopenSession()} style={s.barButton} />
        ) : (
          <Button label="Finish" onPress={() => setSheet({ kind: "finish" })} style={s.barButton} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={session.name}
          onChangeText={(name) => update((current) => ({ ...current, name }))}
          style={s.title}
          placeholderTextColor={F.dim}
          placeholder="Workout name"
          selectionColor={F.acc}
          accessibilityLabel="Workout name"
        />
        <Text style={s.meta}>
          {`${session.date ?? ""}${finished ? " · completed" : ""}${session.deload ? " · deload" : ""} · ${counts.done}/${counts.total} sets`}
        </Text>

        {finished ? (
          <FCard style={s.stats}>
            <View style={s.statRow}>
              <View>
                <Text style={s.meta}>Volume</Text>
                <Text style={s.statValue}>{`${fmtInt(fromKg(sessionVolumeKg(session), unit))} ${unit}`}</Text>
              </View>
              <View>
                <Text style={s.meta}>Sets</Text>
                <Text style={s.statValue}>{String(counts.done)}</Text>
              </View>
            </View>
            {(session.prs ?? []).map((pr) => (
              <View key={pr.exerciseId} style={s.prRow}>
                <Text style={s.exName}>{names[pr.exerciseId] ?? pr.exerciseId}</Text>
                <Text style={s.pr}>{`PR ${round1(pr.weight)} ${pr.unit}×${pr.reps}`}</Text>
              </View>
            ))}
          </FCard>
        ) : null}

        {session.exercises.map((exercise, index) => {
          const previous = previousSets(data.sessions, exercise.exerciseId, session);
          const linkedAbove = session.exercises[index - 1]?.group === exercise.group && Boolean(exercise.group);
          const linkedBelow = isSupersetLeader(session, index);

          return (
            <View
              key={exercise.id}
              style={[s.block, (linkedAbove || linkedBelow) && s.linked, linkedAbove && { marginTop: 10 }]}
            >
              {linkedBelow && !linkedAbove ? <Text style={s.mark}>SUPERSET</Text> : null}
              <View style={s.exHead}>
                <Text style={s.exName}>{exercise.name}</Text>
                <Text style={s.meta}>
                  {previous
                    ? `Last ${formatSets(previous.exercise, unit)}`
                    : "First time"}
                </Text>
              </View>
              {exercise.progressed ? (
                <Text style={s.progress}>{`Hit every rep last time. Up ${unit === "kg" ? "2.5 kg" : "5 lb"}.`}</Text>
              ) : null}
              {exercise.bodyweight ? (
                <Text style={s.meta}>Bodyweight. The weight box is extra load (minus if assisted).</Text>
              ) : null}
              {exercise.tip ? <Text style={s.tip}>{`Tip · ${exercise.tip}`}</Text> : null}

              {exercise.sets.map((set, setIndex) => {
                const ref = previous
                  ? (previous.sets[setIndex] ?? previous.sets[previous.sets.length - 1])
                  : undefined;

                return (
                  <View key={set.id} style={s.setRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={set.warmup ? "Warm-up set. Tap to make a work set" : "Tap to mark as warm-up"}
                      onPress={() => { tap(); update((current) => toggleWarmup(current, index, setIndex, new Date())); }}
                      onLongPress={() => update((current) => removeSet(current, index, setIndex, new Date()))}
                      style={[s.num, set.warmup && s.numWarm]}
                    >
                      <Text style={[s.numText, set.warmup && { color: F.warm }]}>{set.warmup ? "W" : String(exercise.sets.slice(0, setIndex + 1).filter((entry) => !entry.warmup).length)}</Text>
                    </Pressable>
                    <NumberField
                      label={`Set ${setIndex + 1} weight`}
                      decimal
                      value={set.weight}
                      placeholder={ref ? String(round1(ref.weight ?? 0)) : exercise.bodyweight ? "+0" : set.unit ?? unit}
                      onCommit={(weight) => update((current) => setValuesById(current, exercise.id, set.id, { weight }))}
                    />
                    <Text style={s.times}>{`${set.unit ?? unit} ×`}</Text>
                    <NumberField
                      label={`Set ${setIndex + 1} reps`}
                      value={set.reps}
                      placeholder={ref ? String(ref.reps) : "reps"}
                      onCommit={(reps) => update((current) => setValuesById(current, exercise.id, set.id, { reps }))}
                    />
                    <View style={{ flex: 1 }} />
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: set.completed }}
                      accessibilityLabel={`Set ${setIndex + 1} done`}
                      onPress={() => tick(index, setIndex)}
                      style={[s.check, set.completed && s.checkOn]}
                    >
                      <Text style={[s.checkText, set.completed && { color: F.accInk }]}>✓</Text>
                    </Pressable>
                  </View>
                );
              })}

              {exercise.note ? <Text style={s.noteText}>{exercise.note}</Text> : null}

              <View style={s.actions}>
                <Action label="+ Set" onPress={() => update((current) => addSet(current, index, new Date()))} />
                <Action label="Note" onPress={() => setSheet({ kind: "note", index })} />
                <Action label="Swap" onPress={() => setSheet({ kind: "swap", index })} />
                {exercise.bodyweight ? null : <Action label="Plates" onPress={() => setSheet({ kind: "plates", index })} />}
                {index < session.exercises.length - 1 ? (
                  <Action label={linkedBelow ? "Unlink" : "Superset"} onPress={() => update((current) => toggleSuperset(current, index, new Date()))} />
                ) : null}
                {index > 0 ? <Action label="↑" onPress={() => update((current) => moveExerciseUp(current, index, new Date()))} /> : null}
                <Action label="Remove" danger onPress={() => update((current) => removeExercise(current, index, new Date()))} />
              </View>
            </View>
          );
        })}

        <View style={s.footer}>
          <Button kind="ghost" label="Add exercise" onPress={() => setSheet({ kind: "add" })} />
          <Button kind="ghost" label="Workout note" onPress={() => setSheet({ kind: "note", index: -1 })} />
          <Button kind="danger" label="Delete workout" onPress={() => setSheet({ kind: "delete" })} />
        </View>
        {session.notes ? <Text style={s.noteText}>{session.notes}</Text> : null}
      </ScrollView>

      {restEnd !== null && restLeft > 0 && !finished ? (
        <View style={s.rest}>
          <Text style={s.restText}>{`Rest ${formatClock(restLeft * 1000)}`}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRestEnd((value) => (value ?? Date.now()) + 15_000)}>
            <Text style={s.restAction}>+15s</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setRestEnd(null)}>
            <Text style={s.restAction}>Skip</Text>
          </Pressable>
        </View>
      ) : null}

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
        title={sheet.kind === "note" && sheet.index >= 0 ? (exerciseSheet?.name ?? "Note") : "Workout note"}
        initial={sheet.kind === "note" ? (sheet.index >= 0 ? (exerciseSheet?.note ?? "") : (session.notes ?? "")) : ""}
        onSave={(note) => update((current) => setNote(current, sheet.kind === "note" ? sheet.index : -1, note, new Date()))}
      />
      <PlatesSheet
        visible={sheet.kind === "plates"}
        onClose={() => setSheet({ kind: "none" })}
        weight={platesWeight?.weight ?? 0}
        unit={platesWeight?.unit ?? unit}
        barKg={data.settings.barKg}
      />
      <FinishSheet
        visible={sheet.kind === "finish"}
        onClose={() => setSheet({ kind: "none" })}
        open={counts.total - counts.done}
        onFinish={(mode) => void finishWith(mode)}
      />
      <ConfirmSheet
        visible={sheet.kind === "delete"}
        onClose={() => setSheet({ kind: "none" })}
        title="Delete this workout?"
        body="It disappears from history and progress. This can't be undone."
        confirmLabel="Delete workout"
        onConfirm={() => {
          // Drain pending saves first so one can't land after the delete
          // and bring the workout back.
          drafts.flushAll();
          void flush()
            .then(() => onDelete(session.id))
            .then((ok) => {
              if (ok) onClose();
            });
        }}
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
    </View>
    </DraftScope>
  );
}

function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} hitSlop={6}>
      <Text style={[s.action, danger && { color: F.bad }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: F.bg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: F.card, alignItems: "center", justifyContent: "center" },
  backText: { color: F.ink, fontSize: 24, marginTop: -2 },
  clock: { color: F.ink, fontSize: 22, fontWeight: "300", fontVariant: ["tabular-nums"] },
  barButton: { minHeight: 40, paddingHorizontal: 16 },
  content: { padding: 16, paddingBottom: 120 },
  title: { color: F.ink, fontSize: 30, fontWeight: "300", paddingVertical: 4 },
  meta: { color: F.mute, fontSize: 13 },
  stats: { marginTop: 16 },
  statRow: { flexDirection: "row", gap: 32 },
  statValue: { color: F.ink, fontSize: 24, fontWeight: "300" },
  prRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 12 },
  pr: { color: F.acc, fontWeight: "600", fontSize: 14 },
  block: { marginTop: 22 },
  linked: { borderLeftWidth: 2, borderLeftColor: F.acc, paddingLeft: 10 },
  mark: { color: F.acc, fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },
  exHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  exName: { color: F.ink, fontSize: 19, flexShrink: 1 },
  progress: { color: F.ok, fontSize: 13, marginTop: 4 },
  tip: { color: F.mute, fontSize: 13, marginTop: 6, fontStyle: "italic" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  num: { width: 32, height: 32, borderRadius: 16, backgroundColor: F.card2, alignItems: "center", justifyContent: "center" },
  numWarm: { borderWidth: 1, borderColor: F.warm },
  numText: { color: F.mute, fontWeight: "600", fontSize: 13 },
  input: { width: 64, height: 44, borderRadius: 12, backgroundColor: F.card2, borderWidth: 1, borderColor: F.line, color: F.ink, textAlign: "center", fontSize: 16 },
  times: { color: F.mute, fontSize: 13 },
  check: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: F.line, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: F.acc, borderColor: F.acc },
  checkText: { color: F.mute, fontSize: 18 },
  noteText: { color: F.mute, fontSize: 14, marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: F.line },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 },
  action: { color: F.acc, fontSize: 14, fontWeight: "500" },
  footer: { marginTop: 28, gap: 10 },
  rest: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 20, backgroundColor: F.card2, borderRadius: 18, borderWidth: 1, borderColor: F.line, paddingHorizontal: 18, paddingVertical: 14 },
  restText: { color: F.ink, fontSize: 16, flex: 1, fontVariant: ["tabular-nums"] },
  restAction: { color: F.acc, fontWeight: "600", fontSize: 14 },
});
