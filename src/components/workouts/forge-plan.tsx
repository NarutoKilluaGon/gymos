import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

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
  PlanExerciseMenuSheet,
  RenameSheet,
  SupersetInfoSheet,
} from "@/components/workouts/forge-sheets";
import { Button, FCard, Field, Label, Pill, Seg } from "@/components/workouts/forge-ui";
import { Font } from "@/constants/design";
import { F } from "@/constants/forge-theme";
import type { MuscleGroup } from "@/data/exercises";
import type { ForgeData } from "@/hooks/use-forge";
import { parseRepTarget } from "@/services/forge/build";
import { convert, round1, toKg, type WeightUnit } from "@/services/forge/load";
import {
  addDay,
  addPlanExercise,
  duplicateDay,
  movePlanExerciseDown,
  movePlanExerciseUp,
  newPlan,
  planExerciseFor,
  planFromTemplate,
  reinsertDay,
  reinsertPlanExercise,
  removeDay,
  removePlanExercise,
  renameDay,
  toggleScheduleDay,
  updatePlanExercise,
} from "@/services/forge/plan";
import { activePlan, MAX_REST_SECONDS } from "@/services/forge/settings";
import type { CatalogExercise, ForgeSettings, Plan, PlanExercise } from "@/types/forge";
import { showUndoToast } from "@/utils/toast";

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
  onRenameCustom,
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
  onRenameCustom?: (id: string, name: string) => Promise<boolean>;
}) {
  const { settings, catalog, custom } = data;
  const plan = activePlan(settings);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [swapExercise, setSwapExercise] = useState<{ dayId: string; index: number } | null>(null);
  const [addDayName, setAddDayName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuDay, setMenuDay] = useState<string | null>(null);
  const [renameDayTarget, setRenameDayTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameCustomTarget, setRenameCustomTarget] = useState<{ id: string; name: string } | null>(null);
  const [exerciseMenu, setExerciseMenu] = useState<{ dayId: string; index: number } | null>(null);
  const [supersetInfoOpen, setSupersetInfoOpen] = useState(false);

  const currentDay =
    plan?.days.find((d) => d.id === activeDayId) ?? plan?.days[0] ?? null;

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
      const ok = await save((current, now) => {
        const next = addDay(current, name, now);
        const lastDay = next.days[next.days.length - 1];
        if (lastDay) setActiveDayId(lastDay.id);
        return next;
      });

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
        {/* PLAN SELECTION PILLS */}
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
            {/* PLAN CONFIGURATION CARD */}
            <FCard style={s.gap}>
              <DraftTextField
                heading="Plan name"
                accessibilityLabel="Plan name"
                value={plan.name}
                key={plan.id}
                onCommit={(text) => {
                  const name = text.trim();

                  if (name && name !== plan.name) {
                    edit((current, now) => ({
                      ...current,
                      name,
                      updatedAt: now.toISOString(),
                    }));
                  }
                }}
              />
              <Label>Order</Label>
              <Seg
                options={[
                  { value: "week", label: "By weekday" },
                  { value: "rotate", label: "Rotate" },
                ]}
                value={plan.rotate ? "rotate" : "week"}
                onChange={(value) =>
                  edit((current, now) => ({
                    ...current,
                    rotate: value === "rotate",
                    updatedAt: now.toISOString(),
                  }))
                }
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
                  onPress={() =>
                    edit((current, now) => ({
                      ...current,
                      deload: !current.deload,
                      updatedAt: now.toISOString(),
                    }))
                  }
                />
              </View>
            </FCard>

            {/* DAY PICKER STRIP */}
            {plan.days.length > 0 ? (
              <View style={s.dayPickerContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.dayStrip}
                >
                  {plan.days.map((day) => {
                    const assignedDays = !plan.rotate
                      ? Object.entries(plan.schedule)
                          .filter(([, id]) => id === day.id)
                          .map(([wd]) => WEEKDAYS[Number(wd)])
                          .filter(Boolean)
                      : [];
                    const scheduleBadge = assignedDays.length > 0 ? assignedDays.join("·") : null;
                    const isActive = day.id === currentDay?.id;

                    return (
                      <Pressable
                        key={day.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Day ${day.name}`}
                        onPress={() => setActiveDayId(day.id)}
                        style={[s.dayChip, isActive && s.dayChipActive]}
                      >
                        <Text style={[s.dayChipText, isActive && s.dayChipTextActive]}>
                          {day.name}
                        </Text>
                        {scheduleBadge ? (
                          <View style={[s.chipBadge, isActive && s.chipBadgeActive]}>
                            <Text style={[s.chipBadgeText, isActive && s.chipBadgeTextActive]}>
                              {scheduleBadge}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* ACTIVE DAY VIEW */}
            {currentDay ? (
              <FCard key={currentDay.id} style={s.gap}>
                <View style={s.dayHead}>
                  <DraftTextField
                    value={currentDay.name}
                    onCommit={(text) =>
                      edit((current, now) => renameDay(current, currentDay.id, text, now))
                    }
                    style={s.dayName}
                    placeholderTextColor={F.dim}
                    selectionColor={F.acc}
                    accessibilityLabel="Day name"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${currentDay.name} options`}
                    hitSlop={8}
                    style={s.menuBtn}
                    onPress={() => setMenuDay(currentDay.id)}
                  >
                    <Text style={s.menuIcon}>⋯</Text>
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
                          active={owner === currentDay.id}
                          onPress={() =>
                            edit((current, now) =>
                              toggleScheduleDay(current, weekday, currentDay.id, now),
                            )
                          }
                        />
                      );
                    })}
                  </View>
                ) : null}

                {/* EXERCISES IN ACTIVE DAY */}
                {currentDay.exercises.map((exercise, index) => {
                  const isSupersetLeader = !!exercise.superset;
                  const isSupersetPartner =
                    index > 0 && !!currentDay.exercises[index - 1]?.superset;
                  const inSuperset = isSupersetLeader || isSupersetPartner;

                  const catalogEx = catalog.find((c) => c.id === exercise.exerciseId);
                  const muscleGroup = catalogEx?.muscleGroup ?? "Exercise";
                  const primaryMuscles = catalogEx?.primaryMuscles?.length
                    ? catalogEx.primaryMuscles.join(", ")
                    : null;
                  const muscleSub = primaryMuscles ? `${muscleGroup} · ${primaryMuscles}` : muscleGroup;

                  const repParsed = parseRepTarget(exercise.reps);
                  const isFailure = repParsed.kind === "amrap";
                  const repHint =
                    repParsed.kind === "amrap"
                      ? repParsed.min
                        ? `To failure, aim for ${repParsed.min}+`
                        : "To failure (AMRAP). Add a minimum, like 8+, to enable auto-progression"
                      : repParsed.kind === "range"
                        ? `${repParsed.min}–${repParsed.max} reps`
                        : `${repParsed.min || 8} reps`;

                  return (
                    <View
                      key={`${exercise.exerciseId}-${index}`}
                      style={[
                        s.exRow,
                        inSuperset && s.exRowSuperset,
                      ]}
                    >
                      {/* Superset header rail indicator if leader */}
                      {isSupersetLeader ? (
                        <View style={s.supersetTagRow}>
                          <View style={s.supersetBadge}>
                            <Text style={s.supersetBadgeText}>SUPERSET</Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="What's a superset?"
                            onPress={() => setSupersetInfoOpen(true)}
                            hitSlop={6}
                          >
                            <Text style={s.supersetHelpLink}>{"What's this?"}</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {/* Header line: index badge, editable name, overflow menu */}
                      <View style={s.exHeaderLine}>
                        <View style={s.indexBadge}>
                          <Text style={s.indexBadgeText}>{index + 1}</Text>
                        </View>
                        <View style={s.nameWrapper}>
                          <DraftTextField
                            accessibilityLabel={`${exercise.name} name`}
                            value={exercise.name}
                            onCommit={(text) =>
                              editRow(currentDay.id, index, exercise.exerciseId, {
                                name: text.trim() || exercise.name,
                              })
                            }
                            style={s.exName}
                            placeholder="Exercise name"
                            placeholderTextColor={F.dim}
                            selectionColor={F.acc}
                          />
                          <Text style={s.muscleLine}>{muscleSub}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${exercise.name} options`}
                          hitSlop={8}
                          style={s.rowMenuBtn}
                          onPress={() =>
                            setExerciseMenu({ dayId: currentDay.id, index })
                          }
                        >
                          <Text style={s.menuIcon}>⋯</Text>
                        </Pressable>
                      </View>

                      {/* Targets line: Sets, Reps, Failure toggle, Weight */}
                      <View style={s.targets}>
                        <NumberField
                          label={`${exercise.name} sets`}
                          value={exercise.sets}
                          placeholder="sets"
                          onCommit={(sets) =>
                            editRow(currentDay.id, index, exercise.exerciseId, {
                              sets: Math.min(20, Math.max(1, sets || 1)),
                            })
                          }
                        />
                        <Text style={s.times}>×</Text>
                        <DraftTextField
                          accessibilityLabel={`${exercise.name} reps`}
                          value={exercise.reps}
                          onCommit={(text) =>
                            editRow(currentDay.id, index, exercise.exerciseId, {
                              reps: text.trim() || "8-10",
                            })
                          }
                          style={s.reps}
                          placeholder="8-10"
                          placeholderTextColor={F.dim}
                          selectionColor={F.acc}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${exercise.name} failure toggle`}
                          hitSlop={6}
                          onPress={() => {
                            if (isFailure) {
                              const back = repParsed.min
                                ? `${repParsed.min}-${repParsed.min + 2}`
                                : "8-10";
                              editRow(currentDay.id, index, exercise.exerciseId, {
                                reps: back,
                              });
                            } else {
                              const min = repParsed.min || 8;
                              editRow(currentDay.id, index, exercise.exerciseId, {
                                reps: `${min}+`,
                              });
                            }
                          }}
                          style={[s.failBtn, isFailure && s.failBtnActive]}
                        >
                          <Text style={[s.failBtnText, isFailure && s.failBtnTextActive]}>
                            {isFailure ? "Failure" : "To fail"}
                          </Text>
                        </Pressable>
                        <Text style={s.times}>@</Text>
                        <NumberField
                          label={`${exercise.name} weight`}
                          decimal
                          value={
                            exercise.weight
                              ? round1(convert(exercise.weight, "kg", unit))
                              : undefined
                          }
                          placeholder={unit}
                          onCommit={(value) =>
                            editRow(currentDay.id, index, exercise.exerciseId, {
                              weight: Math.max(0, toKg(value, unit)),
                            })
                          }
                        />
                        <Text style={s.unitText}>{unit}</Text>
                      </View>

                      {/* Rep expression hint beneath targets */}
                      <Text style={s.repHintText}>{repHint}</Text>

                      {/* Row actions cluster (direct and test-accessible) */}
                      <View style={s.rowActions}>
                        {index < currentDay.exercises.length - 1 ? (
                          <Action
                            label={exercise.superset ? "Unlink" : "Superset"}
                            onPress={() =>
                              editRowAt(
                                currentDay.id,
                                currentDay.exercises,
                                index,
                                0,
                                (current, now) =>
                                  updatePlanExercise(
                                    current,
                                    currentDay.id,
                                    index,
                                    { superset: !exercise.superset },
                                    now,
                                  ),
                              )
                            }
                          />
                        ) : null}
                        {index > 0 ? (
                          <Action
                            label="↑"
                            onPress={() =>
                              editRowAt(
                                currentDay.id,
                                currentDay.exercises,
                                index,
                                -1,
                                (current, now) =>
                                  movePlanExerciseUp(current, currentDay.id, index, now),
                              )
                            }
                          />
                        ) : null}
                        <Action
                          label="Remove"
                          danger
                          onPress={() => {
                            const targetExercise = exercise;
                            const targetIndex = index;
                            const targetDayId = currentDay.id;
                            editRowAt(
                              currentDay.id,
                              currentDay.exercises,
                              index,
                              1,
                              (current, now) =>
                                removePlanExercise(current, currentDay.id, index, now),
                            );
                            const exerciseName =
                              catalog.find((c) => c.id === targetExercise.exerciseId)?.name ??
                              "Exercise";
                            showUndoToast({
                              message: `${exerciseName} removed`,
                              onUndo: () => {
                                edit((current, now) =>
                                  reinsertPlanExercise(
                                    current,
                                    targetDayId,
                                    targetIndex,
                                    targetExercise,
                                    now,
                                  ),
                                );
                              },
                            });
                          }}
                        />
                      </View>
                    </View>
                  );
                })}

                {/* Dashed Add exercise row at the end of the day */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add exercise"
                  style={s.addExDashed}
                  onPress={() => setPickFor(currentDay.id)}
                >
                  <Plus size={16} color={F.acc} />
                  <Text style={s.addExDashedText}>Add exercise</Text>
                </Pressable>

                <View style={s.pills}>
                  <Pill label="+ Exercise" onPress={() => setPickFor(currentDay.id)} />
                </View>
              </FCard>
            ) : null}

            {/* ADD DAY INPUT CARD */}
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

            <Button
              kind="danger"
              label="Delete this plan"
              onPress={() => setConfirmDelete(true)}
            />
          </>
        )}

        {/* REST TIMER & BAR WEIGHT */}
        <FCard style={s.gap}>
          <Label>Rest timer</Label>
          <Seg
            options={REST_CHOICES}
            value={
              REST_CHOICES.some((entry) => entry.value === settings.restSeconds)
                ? settings.restSeconds
                : 90
            }
            onChange={(restSeconds) =>
              void onSave((current) => ({
                ...current,
                restSeconds: Math.min(MAX_REST_SECONDS, restSeconds),
              }))
            }
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

        {/* SHEETS */}
        <NewPlanSheet
          visible={newOpen}
          onClose={() => setNewOpen(false)}
          onCreate={create}
        />

        <ExercisePickerSheet
          visible={pickFor !== null}
          catalog={catalog}
          onClose={() => {
            setPickFor(null);
            setSwapExercise(null);
          }}
          onCreate={onCreateExercise}
          onPick={(exercise) => {
            if (swapExercise) {
              const { dayId, index } = swapExercise;
              edit((current, now) =>
                updatePlanExercise(
                  current,
                  dayId,
                  index,
                  {
                    exerciseId: exercise.id,
                    name: exercise.name,
                  },
                  now,
                ),
              );
              setSwapExercise(null);
              setPickFor(null);
              return;
            }

            const dayId = pickFor;
            if (dayId) {
              edit((current, now) =>
                addPlanExercise(current, dayId, planExerciseFor(exercise), now),
              );
            }
            setPickFor(null);
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

            if (id) {
              void onSave((current) => ({
                ...current,
                plans: current.plans.filter((entry) => entry.id !== id),
              }));
            }
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
          onRename={() => {
            if (menuDay && plan) {
              const day = plan.days.find((d) => d.id === menuDay);
              if (day) setRenameDayTarget({ id: day.id, name: day.name });
            }
          }}
          onDuplicate={() => {
            if (menuDay && plan) {
              edit((current, now) => duplicateDay(current, menuDay, now));
            }
          }}
          onMoveUp={() => {
            if (menuDay) moveDay(menuDay, -1);
          }}
          onMoveDown={() => {
            if (menuDay) moveDay(menuDay, 1);
          }}
          onDelete={() => {
            if (menuDay && plan) {
              const dayIndex = plan.days.findIndex((d) => d.id === menuDay);
              const targetDay = plan.days[dayIndex];
              if (targetDay) {
                const daySchedule: Record<string, string> = {};
                for (const [k, v] of Object.entries(plan.schedule)) {
                  if (v === targetDay.id) daySchedule[k] = v;
                }
                edit((current, now) => removeDay(current, menuDay, now));
                showUndoToast({
                  message: `${targetDay.name} removed`,
                  onUndo: () => {
                    edit((current, now) =>
                      reinsertDay(current, targetDay, dayIndex, daySchedule, now),
                    );
                  },
                });
              }
            }
          }}
        />

        {typeof RenameSheet === "function" && renameDayTarget ? (
          <RenameSheet
            visible={renameDayTarget !== null}
            onClose={() => setRenameDayTarget(null)}
            title="Rename day"
            initial={renameDayTarget.name}
            onSave={(name) => {
              edit((current, now) => renameDay(current, renameDayTarget.id, name, now));
              setRenameDayTarget(null);
            }}
          />
        ) : null}

        {typeof RenameSheet === "function" && renameCustomTarget ? (
          <RenameSheet
            visible={renameCustomTarget !== null}
            onClose={() => setRenameCustomTarget(null)}
            title="Rename everywhere"
            initial={renameCustomTarget.name}
            onSave={async (name) => {
              if (onRenameCustom) {
                await onRenameCustom(renameCustomTarget.id, name);
              }
              if (currentDay) {
                edit((current, now) => ({
                  ...current,
                  days: current.days.map((d) => ({
                    ...d,
                    exercises: d.exercises.map((e) =>
                      e.exerciseId === renameCustomTarget.id ? { ...e, name } : e,
                    ),
                  })),
                  updatedAt: now.toISOString(),
                }));
              }
              setRenameCustomTarget(null);
            }}
          />
        ) : null}

        {typeof SupersetInfoSheet === "function" ? (
          <SupersetInfoSheet
            visible={supersetInfoOpen}
            onClose={() => setSupersetInfoOpen(false)}
          />
        ) : null}

        {typeof PlanExerciseMenuSheet === "function" && exerciseMenu && currentDay ? (
          <PlanExerciseMenuSheet
            visible={exerciseMenu !== null}
            onClose={() => setExerciseMenu(null)}
            isSuperset={!!currentDay.exercises[exerciseMenu.index]?.superset}
            canMoveUp={exerciseMenu.index > 0}
            canMoveDown={exerciseMenu.index < currentDay.exercises.length - 1}
            isCustom={
              !!custom.find(
                (c) => c.id === currentDay.exercises[exerciseMenu.index]?.exerciseId,
              )
            }
            onSwap={() => {
              setSwapExercise(exerciseMenu);
              setPickFor(exerciseMenu.dayId);
            }}
            onToggleSuperset={() => {
              const idx = exerciseMenu.index;
              const ex = currentDay.exercises[idx];
              if (ex) {
                editRowAt(currentDay.id, currentDay.exercises, idx, 0, (current, now) =>
                  updatePlanExercise(
                    current,
                    currentDay.id,
                    idx,
                    { superset: !ex.superset },
                    now,
                  ),
                );
              }
            }}
            onMoveUp={() => {
              const idx = exerciseMenu.index;
              editRowAt(currentDay.id, currentDay.exercises, idx, -1, (current, now) =>
                movePlanExerciseUp(current, currentDay.id, idx, now),
              );
            }}
            onMoveDown={() => {
              const idx = exerciseMenu.index;
              editRowAt(currentDay.id, currentDay.exercises, idx, 1, (current, now) =>
                movePlanExerciseDown(current, currentDay.id, idx, now),
              );
            }}
            onRenameEverywhere={() => {
              const ex = currentDay.exercises[exerciseMenu.index];
              if (ex) {
                setRenameCustomTarget({ id: ex.exerciseId, name: ex.name });
              }
            }}
            onSupersetInfo={() => setSupersetInfoOpen(true)}
            onRemove={() => {
              const idx = exerciseMenu.index;
              const targetExercise = currentDay.exercises[idx];
              if (!targetExercise) return;
              const targetDayId = currentDay.id;
              editRowAt(currentDay.id, currentDay.exercises, idx, 1, (current, now) =>
                removePlanExercise(current, currentDay.id, idx, now),
              );
              const exerciseName =
                catalog.find((c) => c.id === targetExercise.exerciseId)?.name ?? "Exercise";
              showUndoToast({
                message: `${exerciseName} removed`,
                onUndo: () => {
                  edit((current, now) =>
                    reinsertPlanExercise(current, targetDayId, idx, targetExercise, now),
                  );
                },
              });
            }}
          />
        ) : null}
      </View>
    </DraftScope>
  );
}

function Action({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
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
  dayPickerContainer: { marginHorizontal: -4 },
  dayStrip: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingVertical: 2 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayChipActive: {
    backgroundColor: "rgba(217, 164, 65, 0.15)",
    borderColor: F.acc,
  },
  dayChipText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "500",
    color: F.mute,
  },
  dayChipTextActive: {
    color: F.acc,
    fontWeight: "600",
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: F.card2,
  },
  chipBadgeActive: {
    backgroundColor: "rgba(217, 164, 65, 0.25)",
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: F.dim,
  },
  chipBadgeTextActive: {
    color: F.acc,
  },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dayName: {
    color: F.ink,
    fontSize: 22,
    fontWeight: "300",
    flex: 1,
    paddingVertical: 4,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  menuIcon: { color: F.mute, fontSize: 20 },
  exRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: F.line,
    gap: 8,
  },
  exRowSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: F.acc,
    paddingLeft: 10,
  },
  supersetTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  supersetBadge: {
    backgroundColor: "rgba(217, 164, 65, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(217, 164, 65, 0.35)",
  },
  supersetBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: F.acc,
    letterSpacing: 0.8,
  },
  supersetHelpLink: {
    fontSize: 12,
    color: F.mute,
    textDecorationLine: "underline",
  },
  exHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: {
    fontFamily: Font.sans,
    fontSize: 13,
    fontWeight: "600",
    color: F.mute,
  },
  nameWrapper: {
    flex: 1,
  },
  exName: {
    fontFamily: Font.serif,
    color: F.ink,
    fontSize: 19,
    fontWeight: "400",
  },
  muscleLine: {
    fontFamily: Font.sans,
    fontSize: 12,
    color: F.mute,
    marginTop: 2,
  },
  rowMenuBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  targets: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  times: { color: F.mute, fontSize: 13 },
  reps: {
    width: 68,
    height: 44,
    borderRadius: 12,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    color: F.ink,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
  },
  failBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: F.line,
    backgroundColor: F.card2,
  },
  failBtnActive: {
    backgroundColor: "rgba(209, 96, 74, 0.15)",
    borderColor: F.bad,
  },
  failBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: F.mute,
  },
  failBtnTextActive: {
    color: F.bad,
  },
  unitText: {
    fontSize: 13,
    color: F.mute,
    fontWeight: "500",
  },
  repHintText: {
    fontSize: 11,
    color: F.dim,
    marginTop: -2,
  },
  rowActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 2,
  },
  action: {
    color: F.acc,
    fontSize: 13,
    fontWeight: "500",
  },
  addExDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(217, 164, 65, 0.4)",
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(217, 164, 65, 0.05)",
    marginTop: 4,
  },
  addExDashedText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "600",
    color: F.acc,
  },
});
