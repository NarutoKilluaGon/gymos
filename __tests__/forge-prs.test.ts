import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  detectPrs,
  personalRecords,
  recomputeSessionPrs,
} from "@/services/forge/history";
import { reopen } from "@/services/forge/timing";
import { getAllPRs } from "@/storage/repositories/prs";
import {
  deleteSession,
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/types/gymos";

let n = 0;
const id = () => `pr${++n}`;
const set = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: id(), weight, reps, unit: "kg", completed: true, ...extra,
});
const ex = (exerciseId: string, sets: WorkoutSet[], extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: id(), exerciseId, name: exerciseId, sets, ...extra,
});
const session = (
  sid: string,
  date: string,
  exercises: WorkoutExercise[],
  extra: Partial<WorkoutSession> = {},
): WorkoutSession => ({
  id: sid,
  name: sid,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  date,
  exercises,
  ...extra,
});
const bench = (weight: number, reps: number) => [ex("bench", [set(weight, reps)])];

/** Finish a session the way the app does: stamp `prs` against stored history. */
async function finishAs(s: WorkoutSession): Promise<WorkoutSession> {
  const history = await getAllSessions();

  return saveSession({ ...s, prs: detectPrs(history, s) });
}

const stored = async (sid: string) =>
  (await getAllSessions()).find((entry) => entry.id === sid);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("PR 1: the first qualifying performance is recorded", () => {
  it("personalRecords includes an exercise's first-ever best set", () => {
    const only = session("a", "2026-01-01", bench(100, 5));

    expect(personalRecords([only]).bench).toMatchObject({
      exerciseId: "bench",
      weight: 100,
      reps: 5,
      unit: "kg",
      timestamp: only.endedAt,
    });
  });

  it("still does not flag that first session as a new record", () => {
    const only = session("a", "2026-01-01", bench(100, 5));

    expect(detectPrs([only], only)).toEqual([]);
  });

  it("ignores warm-ups, unticked sets, unfinished sessions and empty sets", () => {
    const warmupOnly = session("w", "2026-01-01", [ex("bench", [set(200, 5, { warmup: true })])]);
    const unticked = session("u", "2026-01-02", [ex("squat", [set(150, 5, { completed: false })])]);
    const live = session("l", "2026-01-03", bench(120, 5), { endedAt: undefined });
    const empty = session("e", "2026-01-04", [ex("row", [set(0, 0)])]);

    expect(personalRecords([warmupOnly, unticked, live, empty])).toEqual({});
  });

  it("finishing the first-ever session stores its best set", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));

    const records = await getAllPRs();

    expect(records.bench).toMatchObject({ weight: 100, reps: 5, unit: "kg" });
    expect((await stored("a"))?.prs).toEqual([]);
  });

  it("an unfinished session does not create a record", async () => {
    await saveSession(session("a", "2026-01-01", bench(100, 5), { endedAt: undefined }));

    expect(await getAllPRs()).toEqual({});
  });
});

describe("PR 2: one scoring rule everywhere", () => {
  it("the record is the best score, not the heaviest weight", () => {
    // 100x5 scores 116.7, 90x10 scores 120.
    const heavy = session("h", "2026-01-01", bench(100, 5));
    const volume = session("v", "2026-01-08", bench(90, 10));

    expect(personalRecords([heavy, volume]).bench).toMatchObject({ weight: 90, reps: 10 });
    expect(detectPrs([heavy, volume], volume).map((pr) => pr.exerciseId)).toEqual(["bench"]);
  });

  it("a tie keeps the earliest performance", () => {
    const first = session("a", "2026-01-01", bench(100, 5));
    const again = session("b", "2026-01-08", bench(100, 5));

    expect(personalRecords([first, again]).bench?.timestamp).toBe(first.endedAt);
  });

  it("bodyweight records use the same load rule as detection", () => {
    const pull = (reps: number, date: string, sid: string) =>
      session(sid, date, [ex("pull", [set(0, reps)], { bodyweight: true })], { bodyweightKg: 80 });
    const a = pull(8, "2026-01-01", "a");
    const b = pull(9, "2026-01-08", "b");

    expect(detectPrs([a, b], b)).toHaveLength(1);
    expect(personalRecords([a, b]).pull).toMatchObject({ reps: 9 });
  });

  it("a lower, backdated session finishing later never replaces a better record", async () => {
    await finishAs(session("old", "2025-12-20", bench(50, 5)));
    await finishAs(session("best", "2026-01-10", bench(100, 5)));
    // Backdated: beats the 50x5 before it, so it is flagged, but it is not the best ever.
    const backdated = await finishAs(session("back", "2026-01-01", bench(80, 5), { backdated: true }));

    expect(backdated.prs).toHaveLength(1);
    expect((await getAllPRs()).bench).toMatchObject({ weight: 100, reps: 5 });
  });

  it("finishing a better session raises the record", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    await finishAs(session("b", "2026-01-08", bench(105, 5)));

    expect((await getAllPRs()).bench).toMatchObject({ weight: 105 });
    expect((await stored("b"))?.prs).toHaveLength(1);
  });
});

describe("PR 3: deleting and reopening re-derive PR state", () => {
  it("deleting the only session holding a record removes it", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    expect((await getAllPRs()).bench).toBeDefined();

    await deleteSession("a");

    expect((await getAllPRs()).bench).toBeUndefined();
  });

  it("deleting the session with the best set falls back to the next best", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    await finishAs(session("b", "2026-01-08", bench(110, 5)));
    expect((await getAllPRs()).bench).toMatchObject({ weight: 110 });

    await deleteSession("b");

    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
  });

  it("deleting an unfinished session leaves the records alone", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    await saveSession(session("live", "2026-01-08", bench(200, 5), { endedAt: undefined }));

    await deleteSession("live");

    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
  });

  it("reopening drops the record that only that session held and clears its flags", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    const b = await finishAs(session("b", "2026-01-08", bench(110, 5)));

    expect(b.prs).toHaveLength(1);

    await saveSession(reopen((await stored("b")) as WorkoutSession, new Date("2026-01-08T12:00:00.000Z")));

    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
    expect((await stored("b"))?.prs).toBeUndefined();
  });

  it("re-finishing a reopened session records what it now holds", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    await finishAs(session("b", "2026-01-08", bench(110, 5)));

    const reopened = reopen((await stored("b")) as WorkoutSession, new Date("2026-01-08T12:00:00.000Z"));

    await saveSession(reopened);
    await finishAs({
      ...reopened,
      endedAt: "2026-01-08T13:00:00.000Z",
      exercises: bench(90, 5),
    });

    expect((await getAllPRs()).bench).toMatchObject({ weight: 100 });
    expect((await stored("b"))?.prs).toEqual([]);
  });

  it("deleting a baseline removes a later record that had nothing left to beat", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    const b = await finishAs(session("b", "2026-01-08", bench(100, 6)));

    expect(b.prs).toHaveLength(1);

    await deleteSession("a");

    // b is now the first-ever performance: stored as the record, not flagged as beating anything.
    expect((await stored("b"))?.prs).toEqual([]);
    expect((await getAllPRs()).bench).toMatchObject({ reps: 6 });
  });

  it("deleting a high baseline gives a later session the record it earned", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 8)));
    await finishAs(session("b", "2026-01-08", bench(100, 6)));
    const c = await finishAs(session("c", "2026-01-15", bench(100, 7)));

    expect(c.prs).toEqual([]);

    await deleteSession("a");

    expect((await stored("c"))?.prs?.map((pr) => pr.exerciseId)).toEqual(["bench"]);
  });

  it("reopening an earlier session re-judges the sessions after it", async () => {
    await finishAs(session("a", "2026-01-01", bench(100, 5)));
    const b = await finishAs(session("b", "2026-01-08", bench(100, 6)));

    expect(b.prs).toHaveLength(1);

    await saveSession(reopen((await stored("a")) as WorkoutSession, new Date("2026-01-01T12:00:00.000Z")));

    expect((await stored("b"))?.prs).toEqual([]);
    expect((await getAllPRs()).bench).toMatchObject({ reps: 6 });
  });

  it("only re-judges the exercises that changed, and only sessions after the change", () => {
    const a = session("a", "2026-01-01", [...bench(100, 5), ex("row", [set(60, 8)])]);
    const b = session("b", "2026-01-08", [...bench(110, 5), ex("row", [set(70, 8)])], {
      prs: [
        { exerciseId: "bench", weight: 110, reps: 5, unit: "kg" },
        { exerciseId: "row", weight: 70, reps: 8, unit: "kg" },
      ],
    });
    const without = [b];

    const changes = recomputeSessionPrs(without, "2026-01-01|0", new Set(["bench"]));

    expect(changes.get("b")?.map((pr) => pr.exerciseId)).toEqual(["row"]);
    expect(recomputeSessionPrs([a, b], "2026-01-08|99999999999999", new Set(["bench"])).size).toBe(0);
  });
});
