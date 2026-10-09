import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  FileText,
  Layers,
  Link2,
  Pause,
  Play,
  Trash2,
  Unlink2,
} from "lucide-react-native";

import { ListRow } from "@/components/ds/list-row";
import {
  Button,
  Field,
  Label,
  Pill,
  Sheet,
} from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import { type MuscleGroup } from "@/data/exercises";
import { MUSCLES_BY_GROUP } from "@/data/muscles";
import {
  exerciseMatchesQuery,
  findSimilarExercise,
  MUSCLE_ORDER,
  normalizeName,
} from "@/services/forge/catalog";
import { round1, type WeightUnit } from "@/services/forge/load";
import { DEFAULT_BAR, platesFor } from "@/services/forge/plates";
import { PLAN_TEMPLATES } from "@/services/forge/plan";
import type { CatalogExercise, LoadType } from "@/types/forge";
import type { SessionPr } from "@/types/gymos";

const LOAD_TYPES: readonly { type: LoadType; label: string }[] = [
  { type: "barbell", label: "Barbell" },
  { type: "dumbbell", label: "Dumbbell" },
  { type: "machine", label: "Machine" },
  { type: "cable", label: "Cable" },
  { type: "bodyweight", label: "Bodyweight" },
  { type: "assisted", label: "Assisted" },
  { type: "timed", label: "Timed" },
  { type: "other", label: "Other" },
];

/** Search the catalogue, filter by muscle, or add your own exercise. */
export function ExercisePickerSheet({
  visible,
  onClose,
  catalog,
  onPick,
  onCreate,
  title = "Add exercise",
}: {
  visible: boolean;
  onClose: () => void;
  catalog: readonly CatalogExercise[];
  onPick: (exercise: CatalogExercise) => void;
  onCreate: (
    name: string,
    muscle: MuscleGroup,
    bodyweight: boolean,
    extra?: {
      loadType?: LoadType;
      primaryMuscles?: string[];
    },
  ) => Promise<CatalogExercise | null>;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [filterMuscle, setFilterMuscle] = useState<MuscleGroup | null>(null);

  // Create form state: No pre-selected Chest
  const [createMuscleGroup, setCreateMuscleGroup] = useState<MuscleGroup | null>(null);
  const [selectedSubMuscles, setSelectedSubMuscles] = useState<string[]>([]);
  const [otherMuscleText, setOtherMuscleText] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [createLoadType, setCreateLoadType] = useState<LoadType>("barbell");

  const shown = useMemo(
    () =>
      catalog.filter(
        (entry) =>
          (!filterMuscle || entry.muscleGroup === filterMuscle) &&
          exerciseMatchesQuery(entry, query),
      ),
    [catalog, filterMuscle, query],
  );

  const exact = catalog.some(
    (entry) =>
      entry.name.toLowerCase() === query.trim().toLowerCase() ||
      normalizeName(entry.name) === normalizeName(query),
  );

  const duplicateCandidate = useMemo(() => {
    if (!query.trim() || exact) return undefined;
    return findSimilarExercise(catalog, query);
  }, [catalog, query, exact]);

  // One pick (or create) per opening.
  const picking = useRef(false);

  const resetCreateForm = () => {
    setCreateMuscleGroup(null);
    setSelectedSubMuscles([]);
    setOtherMuscleText("");
    setShowOtherInput(false);
    setCreateLoadType("barbell");
  };

  const close = () => {
    setQuery("");
    resetCreateForm();
    onClose();
  };

  useEffect(() => {
    if (visible) {
      picking.current = false;
    }
  }, [visible]);

  const isBw = createLoadType === "bodyweight" || createLoadType === "assisted";

  const handleToggleSubMuscle = (sub: string) => {
    setSelectedSubMuscles((prev) =>
      prev.includes(sub) ? prev.filter((m) => m !== sub) : [...prev, sub],
    );
  };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <Field
        placeholder="Search exercises"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={s.wrap}>
        <Pill label="All" active={!filterMuscle} onPress={() => setFilterMuscle(null)} />
        {MUSCLE_ORDER.map((group) => (
          <Pill
            key={group}
            label={group}
            active={filterMuscle === group}
            onPress={() => setFilterMuscle(filterMuscle === group ? null : group)}
          />
        ))}
      </View>

      {shown.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="button"
          onPress={() => {
            if (picking.current) return;

            picking.current = true;
            onPick(entry);
            close();
          }}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Text style={s.rowName}>{entry.name}</Text>
          <Text style={s.rowMeta}>
            {entry.muscleGroup}
            {entry.bodyweight ? " · BW" : ""}
          </Text>
        </Pressable>
      ))}

      {shown.length === 0 ? (
        <Text style={s.empty}>No match. Add it below.</Text>
      ) : null}

      {query.trim() && !exact ? (
        <View style={s.create}>
          <Label>{`Add "${query.trim()}"`}</Label>

          {duplicateCandidate ? (
            <View style={s.dupWarning}>
              <Text style={s.dupText}>
                Did you mean{" "}
                <Text
                  style={s.dupLink}
                  onPress={() => {
                    if (picking.current) return;
                    picking.current = true;
                    onPick(duplicateCandidate);
                    close();
                  }}
                >
                  {duplicateCandidate.name}
                </Text>
                ?
              </Text>
            </View>
          ) : null}

          {/* 1. Muscle Group (REQUIRED) */}
          <Label>Muscle group *</Label>
          <View style={s.wrap}>
            {MUSCLE_ORDER.map((group) => (
              <Pill
                key={group}
                label={group}
                active={createMuscleGroup === group}
                onPress={() => {
                  setCreateMuscleGroup(group);
                  setSelectedSubMuscles([]);
                  setShowOtherInput(false);
                  setOtherMuscleText("");
                }}
              />
            ))}
          </View>

          {/* 2. Specific Muscles Chips for selected group */}
          {createMuscleGroup ? (
            <View style={s.subMusclesBlock}>
              <Label>Specific muscles</Label>
              <View style={s.wrap}>
                {MUSCLES_BY_GROUP[createMuscleGroup].map((sub) => (
                  <Pill
                    key={sub}
                    label={sub}
                    active={selectedSubMuscles.includes(sub)}
                    onPress={() => handleToggleSubMuscle(sub)}
                  />
                ))}
                <Pill
                  label="Other..."
                  active={showOtherInput}
                  onPress={() => setShowOtherInput((prev) => !prev)}
                />
              </View>
              {showOtherInput ? (
                <Field
                  placeholder="Additional muscle name"
                  value={otherMuscleText}
                  onChangeText={setOtherMuscleText}
                  autoCorrect={false}
                />
              ) : null}
            </View>
          ) : null}

          {/* 3. Load Type */}
          <Label>Load type</Label>
          <View style={s.wrap}>
            {LOAD_TYPES.map(({ type, label }) => (
              <Pill
                key={type}
                label={label}
                active={createLoadType === type}
                onPress={() => setCreateLoadType(type)}
              />
            ))}
          </View>

          <Button
            label="Add exercise"
            disabled={!createMuscleGroup}
            onPress={() => {
              if (picking.current || !createMuscleGroup) return;

              const allMuscles = [...selectedSubMuscles];
              if (otherMuscleText.trim() && !allMuscles.includes(otherMuscleText.trim())) {
                allMuscles.push(otherMuscleText.trim());
              }

              picking.current = true;
              void onCreate(query.trim(), createMuscleGroup, isBw, {
                loadType: createLoadType,
                primaryMuscles: allMuscles.length > 0 ? allMuscles : undefined,
              }).then((created) => {
                if (!created) {
                  picking.current = false;
                  return;
                }

                onPick(created);
                close();
              });
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

export function NoteSheet({
  visible,
  onClose,
  title,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  initial: string;
  onSave: (note: string) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label="Save"
          onPress={() => {
            onSave(value);
            onClose();
          }}
        />
      }
    >
      <Field
        placeholder="How did it feel?"
        value={value}
        onChangeText={setValue}
        multiline
        style={s.note}
      />
    </Sheet>
  );
}

export function PlatesSheet({
  visible,
  onClose,
  weight,
  unit,
  barKg,
}: {
  visible: boolean;
  onClose: () => void;
  /** Target load in `unit`. */
  weight: number;
  unit: WeightUnit;
  barKg: number;
}) {
  const bar = unit === "kg" ? barKg : DEFAULT_BAR.lb;
  const result = platesFor(weight, bar, unit);

  return (
    <Sheet visible={visible} onClose={onClose} title="Plates">
      <Text style={s.big}>{`${round1(weight)} ${unit}`}</Text>
      <Text style={s.rowMeta}>{`Bar ${bar} ${unit}`}</Text>

      {result.belowBar ? (
        <Text style={s.empty}>Lighter than the empty bar.</Text>
      ) : result.perSide.length === 0 ? (
        <Text style={s.empty}>Just the bar.</Text>
      ) : (
        <View style={s.plates}>
          <Label>Each side</Label>
          <View style={s.wrap}>
            {result.perSide.map((plate, index) => (
              <View key={`${plate}-${index}`} style={s.plate}>
                <Text style={s.plateText}>{plate}</Text>
              </View>
            ))}
          </View>
          {result.leftover > 0 ? (
            <Text style={s.rowMeta}>
              {`${result.leftover} ${unit} can't be loaded with standard plates.`}
            </Text>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

export function FinishSheet({
  visible,
  onClose,
  open,
  onFinish,
}: {
  visible: boolean;
  onClose: () => void;
  /** Sets not ticked off yet. */
  open: number;
  onFinish: (mode: "keep" | "complete" | "drop") => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Finish workout?">
      {open > 0 ? (
        <Text style={s.rowMeta}>
          {`${open} set${open === 1 ? "" : "s"} not ticked. They won't count unless you mark them done.`}
        </Text>
      ) : (
        <Text style={s.rowMeta}>Everything is ticked off.</Text>
      )}
      <View style={s.actions}>
        {open > 0 ? (
          <>
            <Button label="Mark all done and finish" onPress={() => onFinish("complete")} />
            <Button kind="ghost" label="Drop unticked sets and finish" onPress={() => onFinish("drop")} />
            <Button kind="ghost" label="Finish as is" onPress={() => onFinish("keep")} />
          </>
        ) : (
          <Button label="Finish" onPress={() => onFinish("keep")} />
        )}
        <Button kind="ghost" label="Keep training" onPress={onClose} />
      </View>
    </Sheet>
  );
}

export function SummarySheet({
  visible,
  onClose,
  durationLabel,
  volumeLabel,
  sets,
  prs,
  names,
  trimmed,
  formatPr,
}: {
  visible: boolean;
  onClose: () => void;
  durationLabel: string;
  volumeLabel: string;
  sets: number;
  prs: readonly SessionPr[];
  names: Record<string, string>;
  trimmed: boolean;
  formatPr: (pr: SessionPr) => string;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Workout done"
      footer={<Button label="Done" onPress={onClose} />}
    >
      <View style={s.stats}>
        <Stat label="Time" value={durationLabel} />
        <Stat label="Volume" value={volumeLabel} />
        <Stat label="Sets" value={String(sets)} />
      </View>
      {trimmed ? (
        <Text style={s.rowMeta}>
          You were idle for a while, so the clock stopped shortly after your last set.
        </Text>
      ) : null}
      {prs.length > 0 ? (
        <View style={s.plates}>
          <Label>New records</Label>
          {prs.map((pr) => (
            <View key={pr.exerciseId} style={s.row}>
              <Text style={s.rowName}>{names[pr.exerciseId] ?? pr.exerciseId}</Text>
              <Text style={s.pr}>{formatPr(pr)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.rowMeta}>{label}</Text>
    </View>
  );
}

export function NewPlanSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (template: string | null, name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Sheet visible={visible} onClose={onClose} title="New plan">
      <Field placeholder="Plan name (optional)" value={name} onChangeText={setName} />
      <Label>Start from</Label>
      {Object.keys(PLAN_TEMPLATES).map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          onPress={() => {
            onCreate(key, name);
            setName("");
            onClose();
          }}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Text style={s.rowName}>{key}</Text>
          <Text style={s.rowMeta}>
            {`${PLAN_TEMPLATES[key]?.length ?? 0} days`}
          </Text>
        </Pressable>
      ))}
      <View style={s.actions}>
        <Button
          kind="ghost"
          label="Blank plan"
          onPress={() => {
            onCreate(null, name);
            setName("");
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

export function ConfirmSheet({
  visible,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text style={s.rowMeta}>{body}</Text>
      <View style={s.actions}>
        <Button
          kind="danger"
          label={confirmLabel}
          onPress={() => {
            onConfirm();
            onClose();
          }}
        />
        <Button kind="ghost" label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** Overflow options for a specific exercise in ForgeSession. */
export function ExerciseMenuSheet({
  visible,
  onClose,
  exerciseName,
  isBodyweight,
  isSuperset,
  canMoveUp,
  canMoveDown,
  onNote,
  onSwap,
  onPlates,
  onToggleSuperset,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  isBodyweight?: boolean;
  isSuperset?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onNote: () => void;
  onSwap: () => void;
  onPlates?: () => void;
  onToggleSuperset: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={exerciseName}>
      <ListRow
        icon={<FileText size={18} color={F.mute} />}
        title="Note"
        onPress={() => {
          onClose();
          onNote();
        }}
      />
      <ListRow
        icon={<ArrowLeftRight size={18} color={F.mute} />}
        title="Swap exercise"
        onPress={() => {
          onClose();
          onSwap();
        }}
      />
      {!isBodyweight && onPlates ? (
        <ListRow
          icon={<Layers size={18} color={F.mute} />}
          title="Plates calculator"
          onPress={() => {
            onClose();
            onPlates();
          }}
        />
      ) : null}
      <ListRow
        icon={isSuperset ? <Unlink2 size={18} color={F.mute} /> : <Link2 size={18} color={F.mute} />}
        title={isSuperset ? "Unlink superset" : "Superset with next"}
        onPress={() => {
          onClose();
          onToggleSuperset();
        }}
      />
      {canMoveUp && onMoveUp ? (
        <ListRow
          icon={<ArrowUp size={18} color={F.mute} />}
          title="Move up"
          onPress={() => {
            onClose();
            onMoveUp();
          }}
        />
      ) : null}
      {canMoveDown && onMoveDown ? (
        <ListRow
          icon={<ArrowDown size={18} color={F.mute} />}
          title="Move down"
          onPress={() => {
            onClose();
            onMoveDown();
          }}
        />
      ) : null}
      <ListRow
        icon={<Trash2 size={18} color={F.bad} />}
        title="Remove"
        destructive
        separator={false}
        onPress={() => {
          onClose();
          onRemove();
        }}
      />
    </Sheet>
  );
}

/** Overflow options for the workout session. */
export function WorkoutMenuSheet({
  visible,
  onClose,
  paused,
  onToggleClock,
  onNote,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  paused: boolean;
  onToggleClock: () => void;
  onNote: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Workout options">
      <ListRow
        icon={<FileText size={18} color={F.mute} />}
        title="Workout note"
        onPress={() => {
          onClose();
          onNote();
        }}
      />
      <ListRow
        icon={paused ? <Play size={18} color={F.mute} /> : <Pause size={18} color={F.mute} />}
        title={paused ? "Resume clock" : "Pause clock"}
        onPress={() => {
          onClose();
          onToggleClock();
        }}
      />
      <ListRow
        icon={<Trash2 size={18} color={F.bad} />}
        title="Delete workout"
        destructive
        separator={false}
        onPress={() => {
          onClose();
          onDelete();
        }}
      />
    </Sheet>
  );
}

/** Overflow options for a plan day (reorder days, delete day). */
export function DayMenuSheet({
  visible,
  onClose,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Day options">
      {canMoveUp && onMoveUp ? (
        <ListRow
          icon={<ArrowUp size={18} color={F.mute} />}
          title="Move day up"
          onPress={() => {
            onClose();
            onMoveUp();
          }}
        />
      ) : null}
      {canMoveDown && onMoveDown ? (
        <ListRow
          icon={<ArrowDown size={18} color={F.mute} />}
          title="Move day down"
          onPress={() => {
            onClose();
            onMoveDown();
          }}
        />
      ) : null}
      <ListRow
        icon={<Trash2 size={18} color={F.bad} />}
        title="Delete day"
        destructive
        separator={false}
        onPress={() => {
          onClose();
          onDelete();
        }}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: F.line,
    gap: 12,
  },
  pressed: { opacity: 0.6 },
  rowName: { color: F.ink, fontSize: 15, flexShrink: 1 },
  rowMeta: { color: F.mute, fontSize: 13 },
  empty: { color: F.mute, fontSize: 14, paddingVertical: 16 },
  create: { marginTop: 16 },
  subMusclesBlock: { marginVertical: 4 },
  dupWarning: {
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  dupText: { color: F.ink, fontSize: 14 },
  dupLink: { color: F.acc, fontWeight: "600", textDecorationLine: "underline" },
  note: { minHeight: 96, textAlignVertical: "top" },
  big: { color: F.ink, fontSize: 34, fontWeight: "300" },
  plates: { marginTop: 16 },
  plate: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: F.card2,
    alignItems: "center",
  },
  plateText: { color: F.ink, fontWeight: "600" },
  actions: { gap: 8, marginTop: 16, marginBottom: 8 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1 },
  statValue: { color: F.ink, fontSize: 24, fontWeight: "300" },
  pr: { color: F.acc, fontSize: 14, fontWeight: "600" },
});
