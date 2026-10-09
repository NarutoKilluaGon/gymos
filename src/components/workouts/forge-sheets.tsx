import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dumbbell,
  FileText,
  Flame,
  HelpCircle,
  Layers,
  Link2,
  Pause,
  Pencil,
  Play,
  Plus,
  Target,
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
import type { CalendarDaySummary } from "@/services/forge/calendar";
import { getMonthGrid, getMonthStats } from "@/services/forge/calendar";
import { dateFromKey } from "@/utils/date";
import { dayFor } from "@/services/forge/plan";
import { displayName, plural } from "@/utils/format";
import type { Plan } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";
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

export function RepTargetSheet({
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
  onSave: (target: string) => void;
}) {
  const [value, setValue] = useState(initial);

  const presets = ["5", "8", "8-10", "10-12", "8+", "AMRAP"];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Rep target · ${title}`}
      footer={
        <Button
          label="Save"
          onPress={() => {
            onSave(value.trim());
            onClose();
          }}
        />
      }
    >
      <Field
        placeholder="e.g. 8-10, 8+, AMRAP"
        value={value}
        onChangeText={setValue}
        autoCorrect={false}
      />
      <Label>Presets</Label>
      <View style={s.wrap}>
        {presets.map((preset) => (
          <Pill
            key={preset}
            label={preset}
            active={value === preset}
            onPress={() => setValue(preset)}
          />
        ))}
      </View>
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
  onTargetReps,
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
  onTargetReps?: () => void;
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
      {onTargetReps ? (
        <ListRow
          icon={<Target size={18} color={F.mute} />}
          title="Target reps"
          onPress={() => {
            onClose();
            onTargetReps();
          }}
        />
      ) : null}
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

/** Overflow options for a plan day (rename, duplicate, reorder days, delete day). */
export function DayMenuSheet({
  visible,
  onClose,
  canMoveUp,
  canMoveDown,
  onRename,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onRename?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Day options">
      {onRename ? (
        <ListRow
          icon={<Pencil size={18} color={F.mute} />}
          title="Rename day"
          onPress={() => {
            onClose();
            onRename();
          }}
        />
      ) : null}
      {onDuplicate ? (
        <ListRow
          icon={<Copy size={18} color={F.mute} />}
          title="Duplicate day"
          onPress={() => {
            onClose();
            onDuplicate();
          }}
        />
      ) : null}
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

/** Information sheet explaining what a superset is. */
export function SupersetInfoSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="What's a superset?"
      footer={<Button label="Got it" onPress={onClose} />}
    >
      <Text style={s.bodyText}>
        Two exercises done back to back with no rest between them, then you rest.
        Pair opposite muscles (biceps and triceps, chest and back) to save time.
        In GymOS, link an exercise with the one below it; the rest timer starts
        after the second one.
      </Text>
    </Sheet>
  );
}

/** Overflow options for a plan exercise row. */
export function PlanExerciseMenuSheet({
  visible,
  onClose,
  isSuperset,
  canMoveUp,
  canMoveDown,
  isCustom,
  onSwap,
  onToggleSuperset,
  onMoveUp,
  onMoveDown,
  onRenameEverywhere,
  onSupersetInfo,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  isSuperset: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isCustom?: boolean;
  onSwap: () => void;
  onToggleSuperset: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRenameEverywhere?: () => void;
  onSupersetInfo?: () => void;
  onRemove: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Exercise options">
      <ListRow
        icon={<ArrowLeftRight size={18} color={F.mute} />}
        title="Swap exercise"
        onPress={() => {
          onClose();
          onSwap();
        }}
      />
      <ListRow
        icon={isSuperset ? <Unlink2 size={18} color={F.mute} /> : <Link2 size={18} color={F.mute} />}
        title={isSuperset ? "Unlink superset" : "Superset with next"}
        onPress={() => {
          onClose();
          onToggleSuperset();
        }}
      />
      {onSupersetInfo ? (
        <ListRow
          icon={<HelpCircle size={18} color={F.mute} />}
          title="What's a superset?"
          onPress={() => {
            onClose();
            onSupersetInfo();
          }}
        />
      ) : null}
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
      {isCustom && onRenameEverywhere ? (
        <ListRow
          icon={<Pencil size={18} color={F.mute} />}
          title="Rename everywhere"
          onPress={() => {
            onClose();
            onRenameEverywhere();
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

/** Simple rename modal sheet. */
export function RenameSheet({
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
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);

  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setValue(initial);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label="Save"
          onPress={() => {
            if (value.trim()) onSave(value.trim());
            onClose();
          }}
        />
      }
    >
      <Field
        placeholder="Name"
        value={value}
        onChangeText={setValue}
        autoFocus
      />
    </Sheet>
  );
}

const CALENDAR_WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TodayMenuSheet({
  visible,
  onClose,
  hasFinishedWorkout,
  onAddAnotherWorkout,
  onOpenCalendar,
  onLogCardio,
}: {
  visible: boolean;
  onClose: () => void;
  hasFinishedWorkout: boolean;
  onAddAnotherWorkout: () => void;
  onOpenCalendar: () => void;
  onLogCardio: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Workout options">
      {hasFinishedWorkout ? (
        <ListRow
          icon={<Plus size={18} color={F.mute} />}
          title="Add another workout"
          onPress={() => {
            onClose();
            onAddAnotherWorkout();
          }}
        />
      ) : null}
      <ListRow
        icon={<Calendar size={18} color={F.mute} />}
        title="Workout calendar"
        onPress={() => {
          onClose();
          onOpenCalendar();
        }}
      />
      <ListRow
        icon={<Flame size={18} color={F.mute} />}
        title="Log cardio"
        separator={false}
        onPress={() => {
          onClose();
          onLogCardio();
        }}
      />
    </Sheet>
  );
}

export function CalendarSheet({
  visible,
  onClose,
  summaryMap,
  todayKey,
  selectedKey,
  plan,
  sessions,
  onSelectDate,
  onStartPastWorkout,
}: {
  visible: boolean;
  onClose: () => void;
  summaryMap: Map<string, CalendarDaySummary>;
  todayKey: string;
  selectedKey: string;
  plan?: Plan;
  sessions: readonly WorkoutSession[];
  onSelectDate: (key: string) => void;
  onStartPastWorkout: (key: string) => void;
}) {
  const initialDate = dateFromKey(selectedKey || todayKey);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [inspectedKey, setInspectedKey] = useState<string | null>(selectedKey);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const grid = useMemo(
    () => getMonthGrid(viewYear, viewMonth, summaryMap, todayKey),
    [viewYear, viewMonth, summaryMap, todayKey],
  );

  const stats = useMemo(
    () => getMonthStats(viewYear, viewMonth, summaryMap),
    [viewYear, viewMonth, summaryMap],
  );

  const monthTitle = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  const inspectedSummary = inspectedKey ? summaryMap.get(inspectedKey) : null;
  const isFuture = inspectedKey ? inspectedKey > todayKey : false;
  const futurePlanned = isFuture && plan ? dayFor(plan, inspectedKey!, todayKey, sessions) : null;
  const inspectedHasData = !!(inspectedSummary?.hasStrength || inspectedSummary?.hasCardio);

  return (
    <Sheet visible={visible} onClose={onClose} title="Workout Calendar">
      {/* Month streak / count summary */}
      <View style={s.calStatsRow}>
        <View style={s.calStat}>
          <Text style={s.calStatVal}>{stats.workoutsThisMonth}</Text>
          <Text style={s.calStatLabel}>Workouts</Text>
        </View>
        <View style={s.calStat}>
          <Text style={s.calStatVal}>{stats.cardioThisMonth}</Text>
          <Text style={s.calStatLabel}>Cardio</Text>
        </View>
        <View style={s.calStat}>
          <Text style={s.calStatVal}>{stats.activeStreakDays}d</Text>
          <Text style={s.calStatLabel}>Streak</Text>
        </View>
      </View>

      {/* Month header & navigation */}
      <View style={s.calNavRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          onPress={prevMonth}
          style={s.calNavBtn}
        >
          <ChevronLeft size={20} color={F.ink} />
        </Pressable>
        <Text style={s.calMonthTitle}>{monthTitle}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          onPress={nextMonth}
          style={s.calNavBtn}
        >
          <ChevronRight size={20} color={F.ink} />
        </Pressable>
      </View>

      {/* Monday-first weekday headers */}
      <View style={s.calWeekdaysRow}>
        {CALENDAR_WEEKDAYS.map((wd) => (
          <Text key={wd} style={s.calWeekdayLabel}>
            {wd}
          </Text>
        ))}
      </View>

      {/* Month grid */}
      <View style={s.calGrid}>
        {grid.map((cell) => {
          const isInspected = cell.key === inspectedKey;
          return (
            <Pressable
              key={cell.key}
              accessibilityRole="button"
              accessibilityLabel={`Day ${cell.dayNumber}`}
              onPress={() => {
                setInspectedKey(cell.key);
                if (cell.key <= todayKey && (cell.hasStrength || cell.hasCardio)) {
                  onSelectDate(cell.key);
                  onClose();
                }
              }}
              style={[
                s.calCell,
                !cell.isCurrentMonth && s.calCellFaded,
                cell.isToday && s.calCellToday,
                isInspected && s.calCellInspected,
              ]}
            >
              <Text
                style={[
                  s.calCellNum,
                  !cell.isCurrentMonth && s.calCellNumFaded,
                  cell.isToday && s.calCellNumToday,
                  isInspected && s.calCellNumInspected,
                ]}
              >
                {cell.dayNumber}
              </Text>
              <View style={s.calDotsRow}>
                {cell.hasStrength ? <View style={s.calStrengthDot} /> : null}
                {cell.hasCardio ? <View style={s.calCardioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Day inspection panel */}
      {inspectedKey ? (
        <View style={s.calInspectPanel}>
          <Text style={s.calInspectDate}>{inspectedKey}</Text>
          {isFuture ? (
            <Text style={s.calInspectMeta}>
              {futurePlanned ? `Planned: ${displayName(futurePlanned.name)}` : "Rest day"}
            </Text>
          ) : inspectedHasData ? (
            <View style={s.calInspectActions}>
              <Text style={s.calInspectMeta}>
                {inspectedSummary?.hasStrength ? plural(inspectedSummary.sessions.length, "workout") : ""}
                {inspectedSummary?.hasStrength && inspectedSummary?.hasCardio ? " · " : ""}
                {inspectedSummary?.hasCardio ? plural(inspectedSummary.cardio.length, "cardio session") : ""}
              </Text>
              <Button
                label="View day"
                onPress={() => {
                  onSelectDate(inspectedKey);
                  onClose();
                }}
              />
            </View>
          ) : (
            <View style={s.calInspectActions}>
              <Text style={s.calInspectMeta}>Nothing logged on this day</Text>
              <Button
                label="Log past workout"
                onPress={() => {
                  onStartPastWorkout(inspectedKey);
                  onClose();
                }}
              />
            </View>
          )}
        </View>
      ) : null}
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
  bodyText: { color: F.mute, fontSize: 14, lineHeight: 22 },
  calStatsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  calStat: {
    flex: 1,
    backgroundColor: F.card2,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  calStatVal: { color: F.ink, fontSize: 18, fontWeight: "600" },
  calStatLabel: { color: F.mute, fontSize: 12, marginTop: 2 },
  calNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: F.card2,
  },
  calMonthTitle: { color: F.ink, fontSize: 16, fontWeight: "600" },
  calWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calWeekdayLabel: {
    width: 38,
    textAlign: "center",
    color: F.dim,
    fontSize: 12,
    fontWeight: "600",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 4,
  },
  calCell: {
    width: 38,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: F.card,
  },
  calCellFaded: { opacity: 0.3 },
  calCellToday: { borderWidth: 1, borderColor: F.acc },
  calCellInspected: { backgroundColor: "rgba(217, 164, 65, 0.2)" },
  calCellNum: { color: F.ink, fontSize: 13, fontWeight: "500" },
  calCellNumFaded: { color: F.dim },
  calCellNumToday: { color: F.acc, fontWeight: "700" },
  calCellNumInspected: { color: F.acc, fontWeight: "700" },
  calDotsRow: { flexDirection: "row", gap: 3, marginTop: 3, minHeight: 6 },
  calStrengthDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: F.acc,
  },
  calCardioDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#2DD4BF",
  },
  calInspectPanel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    gap: 8,
  },
  calInspectDate: { color: F.ink, fontSize: 15, fontWeight: "600" },
  calInspectMeta: { color: F.mute, fontSize: 13 },
  calInspectActions: { gap: 10 },
});
