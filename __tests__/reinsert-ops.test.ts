import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  reinsertExercise,
  reinsertSet,
  removeExercise,
  removeSet,
} from "@/services/forge/ops";
import {
  newDay,
  newPlan,
  reinsertDay,
  reinsertPlanExercise,
  removeDay,
  removePlanExercise,
} from "@/services/forge/plan";
import {
  addMeal,
  deleteMeal,
  getAllMeals,
  restoreMeal,
} from "@/storage/repositories/meals";
import {
  addMeasurement,
  deleteMeasurement,
  getMeasurements,
  restoreMeasurement,
} from "@/storage/repositories/measurements";
import {
  addCardioLog,
  getCardioMap,
  removeCardioLog,
  restoreCardioLog,
} from "@/storage/repositories/nourish-cardio";
import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  restoreSavedFood,
} from "@/storage/repositories/saved-foods";
import {
  deleteSleepSession,
  getTodaySleep,
  logSleepDuration,
  restoreSleepSession,
} from "@/storage/repositories/sleep";
import {
  addSupplement,
  getSupplements,
  removeSupplement,
  restoreSupplement,
} from "@/storage/repositories/supplements";
import type { PlanExercise } from "@/types/forge";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("Pure Forge reinsert ops", () => {
  const dummySet1: WorkoutSet = { id: "s1", reps: 10, weight: 50, completed: true };
  const dummySet2: WorkoutSet = { id: "s2", reps: 8, weight: 60, completed: true };
  const dummySet3: WorkoutSet = { id: "s3", reps: 6, weight: 70, completed: false };

  const dummyExercise: WorkoutExercise = {
    id: "e1",
    exerciseId: "bench_press",
    name: "Bench Press",
    sets: [dummySet1, dummySet2, dummySet3],
  };

  const dummySession: WorkoutSession = {
    id: "session-1",
    date: "2026-10-09",
    name: "Chest Day",
    startedAt: "2026-10-09T08:00:00.000Z",
    exercises: [dummyExercise],
  };

  it("reinserts a removed set at its original index", () => {
    const now = new Date();
    // Remove middle set (index 1)
    const afterRemoval = removeSet(dummySession, 0, 1, now);
    expect(afterRemoval.exercises[0].sets.length).toBe(2);
    expect(afterRemoval.exercises[0].sets.map((s) => s.id)).toEqual(["s1", "s3"]);

    // Reinsert back at index 1
    const restored = reinsertSet(afterRemoval, 0, 1, dummySet2, now);
    expect(restored.exercises[0].sets.length).toBe(3);
    expect(restored.exercises[0].sets[1].id).toBe("s2");
    expect(restored.exercises[0].sets.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("reinserts a set when clamped at boundaries", () => {
    const now = new Date();
    const clampedStart = reinsertSet(dummySession, 0, -5, { id: "s0", reps: 5, weight: 20, completed: true }, now);
    expect(clampedStart.exercises[0].sets[0].id).toBe("s0");

    const clampedEnd = reinsertSet(dummySession, 0, 99, { id: "s99", reps: 5, weight: 20, completed: true }, now);
    expect(clampedEnd.exercises[0].sets[clampedEnd.exercises[0].sets.length - 1].id).toBe("s99");
  });

  it("reinserts a removed exercise at its original index", () => {
    const now = new Date();
    const ex2: WorkoutExercise = {
      id: "e2",
      exerciseId: "incline_press",
      name: "Incline Press",
      sets: [dummySet1],
    };
    const sessionWithTwo: WorkoutSession = {
      ...dummySession,
      exercises: [dummyExercise, ex2],
    };

    const afterRemoval = removeExercise(sessionWithTwo, 0, now);
    expect(afterRemoval.exercises.length).toBe(1);
    expect(afterRemoval.exercises[0].id).toBe("e2");

    const restored = reinsertExercise(afterRemoval, 0, dummyExercise, now);
    expect(restored.exercises.length).toBe(2);
    expect(restored.exercises[0].id).toBe("e1");
    expect(restored.exercises[1].id).toBe("e2");
  });

  it("reinserts a removed plan day at original index and restores schedule entries", () => {
    const now = new Date();
    const plan = newPlan("PPL");
    const dayA = newDay("Push");
    const dayB = newDay("Pull");
    const planWithDays = {
      ...plan,
      days: [dayA, dayB],
      schedule: { "1": dayA.id, "2": dayB.id },
    };

    const afterRemove = removeDay(planWithDays, dayA.id, now);
    expect(afterRemove.days.length).toBe(1);
    expect(afterRemove.schedule["1"]).toBeUndefined();

    const restored = reinsertDay(afterRemove, dayA, 0, { "1": dayA.id }, now);
    expect(restored.days.length).toBe(2);
    expect(restored.days[0].id).toBe(dayA.id);
    expect(restored.schedule["1"]).toBe(dayA.id);
  });

  it("reinserts a plan exercise at its original index", () => {
    const now = new Date();
    const plan = newPlan("Test Plan");
    const exA: PlanExercise = { exerciseId: "squat", name: "Squat", sets: 3, reps: "8-10", weight: 100 };
    const exB: PlanExercise = { exerciseId: "lunge", name: "Lunge", sets: 3, reps: "10-12", weight: 20 };
    const day = { ...newDay("Legs"), exercises: [exA, exB] };
    const planWithDay = { ...plan, days: [day] };

    const afterRemove = removePlanExercise(planWithDay, day.id, 0, now);
    expect(afterRemove.days[0].exercises.length).toBe(1);
    expect(afterRemove.days[0].exercises[0].exerciseId).toBe("lunge");

    const restored = reinsertPlanExercise(afterRemove, day.id, 0, exA, now);
    expect(restored.days[0].exercises.length).toBe(2);
    expect(restored.days[0].exercises[0].exerciseId).toBe("squat");
    expect(restored.days[0].exercises[1].exerciseId).toBe("lunge");
  });
});

describe("Repository restore ops", () => {
  it("restoreMeal restores a deleted meal", async () => {
    const created = await addMeal(
      "Oatmeal Bowl",
      {
        calories: 350,
        protein: 15,
        carbs: 55,
        fat: 6,
      },
      undefined,
      { slot: "Breakfast" },
    );

    await deleteMeal(created.id);
    let meals = await getAllMeals();
    expect(meals.some((m) => m.id === created.id)).toBe(false);

    await restoreMeal(created);
    meals = await getAllMeals();
    expect(meals.some((m) => m.id === created.id)).toBe(true);
  });

  it("restoreCardioLog restores a removed cardio log", async () => {
    const dayKey = "2026-10-09";
    const log = await addCardioLog(dayKey, {
      name: "Running",
      detail: "30 min",
      kcal: 300,
      minutes: 30,
    });

    await removeCardioLog(dayKey, log.id);
    let map = await getCardioMap();
    expect(map[dayKey]?.some((c) => c.id === log.id) ?? false).toBe(false);

    await restoreCardioLog(dayKey, log);
    map = await getCardioMap();
    expect(map[dayKey]?.some((c) => c.id === log.id)).toBe(true);
  });

  it("restoreSavedFood restores a deleted saved food", async () => {
    const saved = await addSavedFood("Protein Shake", {
      calories: 200,
      protein: 30,
    });

    await deleteSavedFood(saved.id);
    let foods = await getSavedFoods();
    expect(foods.some((f) => f.id === saved.id)).toBe(false);

    await restoreSavedFood(saved);
    foods = await getSavedFoods();
    expect(foods.some((f) => f.id === saved.id)).toBe(true);
  });

  it("restoreSleepSession restores a deleted sleep session", async () => {
    await logSleepDuration(7, 30);
    const sleepSessions = await getTodaySleep();
    expect(sleepSessions.length).toBeGreaterThan(0);
    const sessionToRestore = sleepSessions[0];

    await deleteSleepSession(sessionToRestore.id);
    let currentSleep = await getTodaySleep();
    expect(currentSleep.some((s) => s.id === sessionToRestore.id)).toBe(false);

    await restoreSleepSession(sessionToRestore);
    currentSleep = await getTodaySleep();
    expect(currentSleep.some((s) => s.id === sessionToRestore.id)).toBe(true);
  });

  it("restoreSupplement restores a deleted supplement", async () => {
    const created = await addSupplement("Creatine Monohydrate");
    expect(created).not.toBeNull();
    if (!created) return;

    await removeSupplement(created.id);
    let list = await getSupplements();
    expect(list.some((s) => s.id === created.id)).toBe(false);

    await restoreSupplement(created);
    list = await getSupplements();
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });

  it("restoreMeasurement restores a deleted measurement", async () => {
    const measurement = await addMeasurement("weight", 75.5, "kg");

    await deleteMeasurement(measurement.id);
    let measurements = await getMeasurements("weight");
    expect(measurements.some((m) => m.id === measurement.id)).toBe(false);

    await restoreMeasurement(measurement);
    measurements = await getMeasurements("weight");
    expect(measurements.some((m) => m.id === measurement.id)).toBe(true);
  });
});
