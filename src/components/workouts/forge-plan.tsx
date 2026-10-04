import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  DraftScope,
  NumberField,
  type DraftRegistry,
} from "@/components/workouts/forge-session";
import {
  ConfirmSheet,
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

  /** Edit the active plan atomically against whatever is stored now. */
  const edit = (change: (current: Plan, now: Date) => Plan) => {
    if (!plan) return;

    const id = plan.id;

    void onSave((current) => ({
      ...current,
      plans: current.plans.map((entry) =>
        entry.id === id ? change(entry, new Date()) : entry,
      ),
    }));
  };

  /** Edit one exercise row, but only if that row is still the same
   *  exercise (a draft for a removed row must not hit its neighbour). */
  const editRow = (dayId: string, index: number, exerciseId: string, patch: Partial<PlanExercise>) =>
    edit((current, now) =>
      current.days.find((entry) => entry.id === dayId)?.exercises[index]?.exerciseId === exerciseId
        ? updatePlanExercise(current, dayId, index, patch, now)
        : current,
    );

  const create = (template: string | null, name: string) => {
    const made =
      (template ? planFromTemplate(template, catalog) : null) ?? newPlan(name);

    if (name.trim()) made.name = name.trim();

    void onSave((current) => ({
      ...current,
      plans: [...current.plans, made],
      activePlanId: made.id,
    }));
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
            <Field
              label="Plan name"
              defaultValue={plan.name}
              key={plan.id}
              onEndEditing={(event: { nativeEvent: { text: string } }) => {
                const name = event.nativeEvent.text.trim();

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
                <TextInput
                  defaultValue={day.name}
                  onEndEditing={(event: { nativeEvent: { text: string } }) => edit((current, now) => renameDay(current, day.id, event.nativeEvent.text, now))}
                  style={s.dayName}
                  placeholderTextColor={F.dim}
                  selectionColor={F.acc}
                  accessibilityLabel="Day name"
                />
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
                  <Text style={s.exName}>{exercise.name}</Text>
                  <View style={s.targets}>
                    <NumberField
                      label={`${exercise.name} sets`}
                      value={exercise.sets}
                      placeholder="sets"
                      onCommit={(sets) => editRow(day.id, index, exercise.exerciseId, { sets: Math.min(20, Math.max(1, sets || 1)) })}
                    />
                    <Text style={s.times}>×</Text>
                    <TextInput
                      accessibilityLabel={`${exercise.name} reps`}
                      defaultValue={exercise.reps}
                      onEndEditing={(event: { nativeEvent: { text: string } }) => edit((current, now) => updatePlanExercise(current, day.id, index, { reps: event.nativeEvent.text.trim() || "8-10" }, now))}
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
                      <Action label={exercise.superset ? "Unlink" : "Superset"} onPress={() => edit((current, now) => updatePlanExercise(current, day.id, index, { superset: !exercise.superset }, now))} />
                    ) : null}
                    {index > 0 ? <Action label="↑" onPress={() => edit((current, now) => movePlanExerciseUp(current, day.id, index, now))} /> : null}
                    <Action label="Remove" danger onPress={() => edit((current, now) => removePlanExercise(current, day.id, index, now))} />
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
              onPress={() => {
                edit((current, now) => addDay(current, addDayName, now));
                setAddDayName("");
              }}
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
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  dayName: { color: F.ink, fontSize: 22, fontWeight: "300", flex: 1, paddingVertical: 4 },
  remove: { color: F.bad, fontSize: 13 },
  exRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: F.line, gap: 8 },
  exName: { color: F.ink, fontSize: 16 },
  targets: { flexDirection: "row", alignItems: "center", gap: 8 },
  times: { color: F.mute },
  reps: { width: 72, height: 44, borderRadius: 12, backgroundColor: F.card2, borderWidth: 1, borderColor: F.line, color: F.ink, textAlign: "center", fontSize: 16 },
  rowActions: { flexDirection: "row", gap: 16 },
  action: { color: F.acc, fontSize: 14, fontWeight: "500" },
});
