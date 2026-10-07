import AsyncStorage from "@react-native-async-storage/async-storage";

import { detectPrs } from "@/services/forge/history";
import { getAllPRs } from "@/storage/repositories/prs";
import {
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";

let n = 0;
const id = () => `ef${++n}`;
const set = (weight: number, reps: number): WorkoutSet => ({
  id: id(),
  weight,
  reps,
  unit: "kg",
  completed: true,
});
const ex = (exerciseId: string, sets: WorkoutSet[]): WorkoutExercise => ({
  id: id(),
  exerciseId,
  name: exerciseId,
  sets,
});
const lift = (exerciseId: string, weight: number, reps: number) => [
  ex(exerciseId, [set(weight, reps)]),
];
const session = (
  sid: string,
  date: string,
  exercises: WorkoutExercise[],
): WorkoutSession => ({
  id: sid,
  name: sid,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  date,
  exercises,
});

/** Finish a session the way the app does: stamp `prs` against stored history. */
async function finishAs(s: WorkoutSession): Promise<WorkoutSession> {
  const history = await getAllSessions();

  return saveSession({ ...s, prs: detectPrs(history, s) });
}

const stored = async (sid: string) =>
  (await getAllSessions()).find((entry) => entry.id === sid) as WorkoutSession;

/**
 * Edit an already-finished session the way the open workout screen does:
 * save the live copy (still carrying the `prs` stamped when it finished).
 */
async function editFinished(
  sid: string,
  exercises: WorkoutExercise[],
): Promise<void> {
  await saveSession({ ...(await stored(sid)), exercises });
}

const prIds = (s: WorkoutSession | undefined) =>
  (s?.prs ?? []).map((pr) => pr.exerciseId).sort();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("A2: editing a finished workout re-derives PR state", () => {
  it("removes a PR that is no longer valid after the edit", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 5)));
    const b = await finishAs(session("b", "2026-01-08", lift("bench", 110, 5)));

    expect(prIds(b)).toEqual(["bench"]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 110 });

    // Edit b down so it no longer beats a.
    await editFinished("b", lift("bench", 90, 5));

    expect(prIds(await stored("b"))).toEqual([]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
  });

  it("creates a PR the edited workout newly earns", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 5)));
    const b = await finishAs(session("b", "2026-01-08", lift("bench", 90, 5)));

    expect(prIds(b)).toEqual([]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });

    // Edit b up so it now beats a.
    await editFinished("b", lift("bench", 110, 5));

    expect((await stored("b")).prs).toEqual([
      { exerciseId: "bench", weight: 110, reps: 5, unit: "kg" },
    ]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 110, reps: 5 });
  });

  it("refreshes the stamped values when the edited workout is still a PR", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 5)));
    await finishAs(session("b", "2026-01-08", lift("bench", 110, 5)));

    await editFinished("b", lift("bench", 105, 5));

    expect((await stored("b")).prs).toEqual([
      { exerciseId: "bench", weight: 105, reps: 5, unit: "kg" },
    ]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 105 });
  });

  it("clears the PR when the edit removes the exercise entirely", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 5)));
    await finishAs(session("b", "2026-01-08", lift("bench", 110, 5)));

    await editFinished("b", []);

    expect(prIds(await stored("b"))).toEqual([]);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
  });

  it("leaves PRs held by other workouts and exercises intact", async () => {
    await finishAs(
      session("a", "2026-01-01", [
        ...lift("bench", 100, 5),
        ...lift("squat", 100, 5),
      ]),
    );
    await finishAs(session("b", "2026-01-08", lift("bench", 110, 5)));
    await finishAs(session("c", "2026-01-15", lift("bench", 120, 5)));
    await finishAs(session("d", "2026-01-09", lift("squat", 110, 5)));

    const dBefore = await stored("d");
    const cBefore = await stored("c");

    expect(prIds(dBefore)).toEqual(["squat"]);
    expect(prIds(cBefore)).toEqual(["bench"]);

    // b loses its PR; c (120) still beats everything before it.
    await editFinished("b", lift("bench", 90, 5));

    expect(prIds(await stored("b"))).toEqual([]);
    expect((await stored("c")).prs).toEqual(cBefore.prs);
    expect((await stored("d")).prs).toEqual(dBefore.prs);

    const records = await getAllPRs();

    expect(records.bench).toMatchObject({ weight: 120 });
    expect(records.squat).toMatchObject({ weight: 110 });
  });

  it("re-judges later workouts that were measured against the edited one", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 8)));
    await finishAs(session("b", "2026-01-08", lift("bench", 100, 6)));
    const c = await finishAs(session("c", "2026-01-15", lift("bench", 100, 7)));

    expect(prIds(c)).toEqual([]);

    // Lowering the baseline workout gives c the record it now earns.
    await editFinished("a", lift("bench", 100, 5));

    expect(prIds(await stored("c"))).toEqual(["bench"]);
    expect((await getAllPRs()).bench).toMatchObject({ reps: 7 });
  });

  it("an edit that changes no PR leaves the stored state as it was", async () => {
    await finishAs(session("a", "2026-01-01", lift("bench", 100, 5)));
    await finishAs(session("b", "2026-01-08", lift("bench", 110, 5)));

    const before = await stored("b");
    const recordsBefore = await getAllPRs();

    await saveSession({ ...before, notes: "felt strong" });

    expect((await stored("b")).prs).toEqual(before.prs);
    expect(await getAllPRs()).toEqual(recordsBefore);
  });
});
