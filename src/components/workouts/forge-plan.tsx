import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  DraftScope,
  DraftTextField,
  NumberField,
  type DraftRegistry,
} from "@/components/workouts/forge-session";
import {
  ConfirmSheet,
  DayMenuSheet,
  ExercisePickerSheet,
  NewPlanSheet,
} from "@/components/workouts/forge-sheets";
import { Button, FCard, Field, Label, Pill, Seg } from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import type { MuscleGroup } from "@/data/exercises";
import type { ForgeData } from "@/hooks/use-forge";
import { convert, round1, toKg, type WeightUnit } from "@/services/forge/load";
import {
  addDay,
  addPlanExercise,
  movePlanExerciseUp,
  newPlan,
  planExerciseFor,
  planFromTemplate,
  removeDay,
  removePlanExercise,
  renameDay,
  toggleScheduleDay,
  updatePlanExercise,
} from "@/services/forge/plan";
import { activePlan, MAX_REST_SECONDS } from "@/services/forge/settings";
import type { CatalogExercise, ForgeSettings, Plan, PlanExercise } from "@/types/forge";
import { displayName } from "@/utils/format";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const REST_CHOICES = [
  { value: 0, label: "Off" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 120, label: "2m" },
  { value: 180, label: "3m" },
] as const;

type Change = (current: ForgeSettings) => ForgeSettings;

export function PlanView({
  data,
  unit,
  onSave,
  onCreateExercise,
  drafts,
}: {
  data: ForgeData;
  unit: WeightUnit;
  onSave: (change: Change) => Promise<boolean>;
  /** Lets the parent commit pending number drafts before leaving this tab. */
  drafts?: DraftRegistry;
  onCreateExercise: (
    name: string,
    muscle: MuscleGroup,
    bodyweight: boolean,
  ) => Promise<CatalogExercise | null>;
}) {
  const { settings, catalog } = data;
  const plan = activePlan(settings);
  const [newOpen, setNewOpen] = useState(false);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [addDayName, setAddDayName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuDay, setMenuDay] = useState<string | null>(null);

  const moveDay = (dayId: string, direction: -1 | 1) => {
    edit((current, now) => {
      const idx = current.days.findIndex((d) => d.id === dayId);
      if (idx === -1) return current;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= current.days.length) return current;
      const days = [...current.days];
      const [moved] = days.splice(idx, 1);
      if (!moved) return current;
      days.splice(targetIdx, 0, moved);
      return { ...current, days, updatedAt: now.toISOString() };
    });
  };

  /** Edit the active plan atomically against whatever is stored now.
   *  Resolves whether the change was saved (false when there is no plan). */
  const save = (change: (current: Plan, now: Date) => Plan): Promise<boolean> => {
    if (!plan) return Promise.resolve(false);

    const id = plan.id;

    return onSave((current) => ({
      ...current,
      plans: current.plans.map((entry) =>
        entry.id === id ? change(entry, new Date()) : entry,
      ),
    }));
  };

  const edit = (change: (current: Plan, now: Date) => Plan) => {
    void save(change);
  };

  /** Edit one exercise row, but only if that row is still the same
   *  exercise (a draft for a removed row must not hit its neighbour). */
  const editRow = (dayId: string, index: number, exerciseId: string, patch: Partial<PlanExercise>) =>
    edit((current, now) =>
      current.days.find((entry) => entry.id === dayId)?.exercises[index]?.exerciseId === exerciseId
        ? updatePlanExercise(current, dayId, index, patch, now)
        : current,
    );

  /** Row actions that address an exercise by position (remove, move up,
   *  superset). `shown` is the day's rows as rendered when the button was
   *  drawn. The change only applies if the stored row at `index` is still the
   *  same exercise, and, when `around` names a neighbour the action also
   *  shifts or touches (-1 previous, +1 next), that neighbour is unchanged
   *  too. Otherwise this button is stale (an earlier tap already removed or
   *  moved a row) and nothing happens, rather than hitting whichever row slid
   *  into that index. Editing sets, reps or weight does not affect the check. */
  const editRowAt = (
    dayId: string,
    shown: readonly PlanExercise[],
    index: number,
    around: -1 | 0 | 1,
    change: (current: Plan, now: Date) => Plan,
  ) =>
    edit((current, now) => {
      const stored = current.days.find((entry) => entry.id === dayId)?.exercises;
      const same = (i: number) => stored?.[i]?.exerciseId === shown[i]?.exerciseId;

      return stored && same(index) && (around === 0 || same(index + around))
        ? change(current, now)
        : current;
    });

  // One New plan per opening of the sheet: two quick taps (a template, then
  // Blank, or the same one twice) must not create two plans. Held until the
  // save settles, because the sheet stays tappable while it slides away.
  const creating = useRef(false);

  const create = (template: string | null, name: string) => {
    if (creating.current) return;

    creating.current = true;

    const made =
      (template ? planFromTemplate(template, catalog) : null) ?? newPlan(name);

    if (name.trim()) made.name = name.trim();

    void onSave((current) => ({
      ...current,
      plans: [...current.plans, made],
      activePlanId: made.id,
    })).finally(() => {
      creating.current = false;
    });
  };

  // Add day: keep the typed name until the day is really saved, and ignore a
  // second tap while a save is running (it would add a second, default-named
  // "Day" once the field cleared).
  const addingDay = useRef(false);

  const submitDay = async () => {
    if (addingDay.current) return;

    addingDay.current = true;

    const name = addDayName;

    try {
      const ok = await save((current, now) => addDay(current, name, now));

      // Clear only after success, and only if the field still holds what was
      // submitted (the person may have started typing the next name).
      if (ok) setAddDayName((typed) => (typed === name ? "" : typed));
    } finally {
      addingDay.current = false;
    }
  };

  return (
    <DraftScope value={drafts ?? null}>
    <View style={s.root}>
      <View style={s.pills}>
        {settings.plans.map((entry) => (
          <Pill
            key={entry.id}
            label={entry.name}
            active={entry.id === plan?.id}
            onPress={() => void onSave((current) => ({ ...current, activePlanId: entry.id }))}
          />
        ))}
        <Pill label="+ New plan" onPress={() => setNewOpen(true)} />
      </View>

      {!plan ? (
        <FCard>
          <Text style={s.meta}>No plan yet. Pick a template or start blank.</Text>
          <View style={{ marginTop: 12 }}>
            <Button label="Create a plan" onPress={() => setNewOpen(true)} />
          </View>
        </FCard>
      ) : (
        <>
          <FCard style={s.gap}>
            <DraftTextField
              heading="Plan name"
              accessibilityLabel="Plan name"
              value={plan.name}
              key={plan.id}
              onCommit={(text) => {
                const name = text.trim();

                if (name && name !== plan.name) edit((current, now) => ({ ...current, name, updatedAt: now.toISOString() }));
              }}
            />
            <Label>Order</Label>
            <Seg
              options={[
                { value: "week", label: "By weekday" },
                { value: "rotate", label: "Rotate" },
              ]}
              value={plan.rotate ? "rotate" : "week"}
              onChange={(value) => edit((current, now) => ({ ...current, rotate: value === "rotate", updatedAt: now.toISOString() }))}
            />
            <Text style={s.meta}>
              {plan.rotate
                ? "Each workout starts the day after the one you did last."
                : "Pick the weekdays each day is scheduled on."}
            </Text>
            <View style={s.pills}>
              <Pill
                label="Deload week"
                active={plan.deload}
                onPress={() => edit((current, now) => ({ ...current, deload: !current.deload, updatedAt: now.toISOString() }))}
              />
            </View>
          </FCard>

          {plan.days.map((day) => (
            <FCard key={day.id} style={s.gap}>
              <View style={s.dayHead}>
                <DraftTextField
                  value={day.name}
                  onCommit={(text) => edit((current, now) => renameDay(current, day.id, text, now))}
                  style={s.dayName}
                  placeholderTextColor={F.dim}
                  selectionColor={F.acc}
                  accessibilityLabel="Day name"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${day.name} options`}
                  hitSlop={8}
                  style={s.menuBtn}
                  onPress={() => setMenuDay(day.id)}
                >
                  <Text style={s.menuIcon}>⋯</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => edit((current, now) => removeDay(current, day.id, now))}>
                  <Text style={s.remove}>Delete day</Text>
                </Pressable>
              </View>

              {!plan.rotate ? (
                <View style={s.pills}>
                  {WEEKDAYS.map((label, weekday) => {
                    const owner = plan.schedule[String(weekday)];

                    return (
                      <Pill
                        key={label}
                        label={label}
                        active={owner === day.id}
                        onPress={() => edit((current, now) => toggleScheduleDay(current, weekday, day.id, now))}
                      />
                    );
                  })}
                </View>
              ) : null}

              {day.exercises.map((exercise, index) => (
                <View key={`${exercise.exerciseId}-${index}`} style={s.exRow}>
                  <Text style={s.exName}>{displayName(exercise.name)}</Text>
                  <View style={s.targets}>
                    <NumberField
                      label={`${exercise.name} sets`}
                      value={exercise.sets}
                      placeholder="sets"
                      onCommit={(sets) => editRow(day.id, index, exercise.exerciseId, { sets: Math.min(20, Math.max(1, sets || 1)) })}
                    />
                    <Text style={s.times}>×</Text>
                    <DraftTextField
                      accessibilityLabel={`${exercise.name} reps`}
                      value={exercise.reps}
                      onCommit={(text) => editRow(day.id, index, exercise.exerciseId, { reps: text.trim() || "8-10" })}
                      style={s.reps}
                      placeholder="8-10"
                      placeholderTextColor={F.dim}
                      selectionColor={F.acc}
                    />
                    <Text style={s.times}>@</Text>
                    <NumberField
                      label={`${exercise.name} weight`}
                      decimal
                      value={exercise.weight ? round1(convert(exercise.weight, "kg", unit)) : undefined}
                      placeholder={unit}
                      onCommit={(value) => editRow(day.id, index, exercise.exerciseId, { weight: Math.max(0, toKg(value, unit)) })}
                    />
                  </View>
                  <View style={s.rowActions}>
                    {index < day.exercises.length - 1 ? (
                      <Action label={exercise.superset ? "Unlink" : "Superset"} onPress={() => editRowAt(day.id, day.exercises, index, 0, (current, now) => updatePlanExercise(current, day.id, index, { superset: !exercise.superset }, now))} />
                    ) : null}
                    {index > 0 ? <Action label="↑" onPress={() => editRowAt(day.id, day.exercises, index, -1, (current, now) => movePlanExerciseUp(current, day.id, index, now))} /> : null}
                    <Action label="Remove" danger onPress={() => editRowAt(day.id, day.exercises, index, 1, (current, now) => removePlanExercise(current, day.id, index, now))} />
                  </View>
                </View>
              ))}

              <View style={s.pills}>
                <Pill label="+ Exercise" onPress={() => setPickFor(day.id)} />
              </View>
            </FCard>
          ))}

          <FCard style={s.gap}>
            <Field
              label="Add a day"
              placeholder="Push, Legs, Day A…"
              value={addDayName}
              onChangeText={setAddDayName}
              returnKeyType="done"
            />
            <Button
              kind="ghost"
              label="Add day"
              onPress={() => void submitDay()}
            />
          </FCard>

          <Button kind="danger" label="Delete this plan" onPress={() => setConfirmDelete(true)} />
        </>
      )}

      <FCard style={s.gap}>
        <Label>Rest timer</Label>
        <Seg
          options={REST_CHOICES}
          value={REST_CHOICES.some((entry) => entry.value === settings.restSeconds) ? settings.restSeconds : 90}
          onChange={(restSeconds) => void onSave((current) => ({ ...current, restSeconds: Math.min(MAX_REST_SECONDS, restSeconds) }))}
        />
        <Text style={s.meta}>Starts after you tick a set. Skipped between supersets.</Text>
        <Label>Barbell weight (kg)</Label>
        <NumberField
          label="Barbell weight"
          decimal
          value={settings.barKg}
          placeholder="20"
          onCommit={(barKg) => void onSave((current) => ({ ...current, barKg }))}
        />
      </FCard>

      <NewPlanSheet visible={newOpen} onClose={() => setNewOpen(false)} onCreate={create} />
      <ExercisePickerSheet
        visible={pickFor !== null}
        catalog={catalog}
        onClose={() => setPickFor(null)}
        onCreate={onCreateExercise}
        onPick={(exercise) => {
          const dayId = pickFor;

          if (dayId) edit((current, now) => addPlanExercise(current, dayId, planExerciseFor(exercise), now));
        }}
      />
      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this plan?"
        body="Your logged workouts stay. Only the plan is removed."
        confirmLabel="Delete plan"
        onConfirm={() => {
          const id = plan?.id;

          if (id) void onSave((current) => ({ ...current, plans: current.plans.filter((entry) => entry.id !== id) }));
        }}
      />
      <DayMenuSheet
        visible={menuDay !== null}
        onClose={() => setMenuDay(null)}
        canMoveUp={plan !== null && plan.days.findIndex((d) => d.id === menuDay) > 0}
        canMoveDown={
          plan !== null &&
          menuDay !== null &&
          plan.days.findIndex((d) => d.id === menuDay) < plan.days.length - 1
        }
        onMoveUp={() => {
          if (menuDay) moveDay(menuDay, -1);
        }}
        onMoveDown={() => {
          if (menuDay) moveDay(menuDay, 1);
        }}
        onDelete={() => {
          if (menuDay) edit((current, now) => removeDay(current, menuDay, now));
        }}
      />
    </View>
    </DraftScope>
  );
}

function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <Text style={[s.action, danger && { color: F.bad }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  gap: { gap: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  meta: { color: F.mute, fontSize: 13 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  dayName: { color: F.ink, fontSize: 22, fontWeight: "300", flex: 1, paddingVertical: 4 },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  menuIcon: { color: F.mute, fontSize: 20 },
  remove: { color: F.bad, fontSize: 13 },
  exRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: F.line, gap: 8 },
  exName: { color: F.ink, fontSize: 16 },
  targets: { flexDirection: "row", alignItems: "center", gap: 8 },
  times: { color: F.mute },
  reps: { width: 72, height: 48, borderRadius: 14, backgroundColor: F.card2, borderWidth: 1, borderColor: F.line, color: F.ink, textAlign: "center", fontSize: 17, fontWeight: "500" },
  rowActions: { flexDirection: "row", gap: 16 },
  action: { color: F.acc, fontSize: 14, fontWeight: "500" },
});
