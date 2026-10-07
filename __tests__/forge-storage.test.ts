import { addCustomExercise, deleteCustomExercise, getCustomExercises, getForgeSettings, updateForgeSettings } from "@/storage/repositories/forge-settings";
import { createRoutine } from "@/storage/repositories/routines";
import { deleteSession, getActiveSession, getAllSessions, saveSession } from "@/storage/repositories/workout-sessions";
import { getCompletedWorkouts } from "@/storage/repositories/workouts";
import { getEvents } from "@/storage/events";
import { getTimeline } from "@/services/timeline";
import { setStorage } from "@/storage/storage";
import type { WorkoutSession } from "@/types/gymos";

const mk = (id: string, date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id, name: id, startedAt: `${date}T10:00:00.000Z`, date, exercises: [], ...extra,
});

/** A completed work set: a finished session needs one to count as a workout. */
const worked: Partial<WorkoutSession> = {
  exercises: [
    { id: "e1", exerciseId: "bench", name: "Bench", sets: [{ id: "s1", reps: 5, weight: 60, completed: true }] },
  ],
};

describe("workout session repository", () => {
  it("upserts by id, active until finished", async () => {
    await saveSession(mk("s1", "2026-03-01"));
    expect((await getActiveSession())?.id).toBe("s1");
    await saveSession(mk("s1", "2026-03-01", { name: "renamed" }));
    const all = await getAllSessions();
    expect(all.filter((s) => s.id === "s1").length).toBe(1);
    expect(all[0].name).toBe("renamed");
  });
  it("fills date for legacy sessions", async () => {
    await setStorage("@gymos/daily", {
      "2026-02-02": { date: "2026-02-02", water: [], workouts: [{ id: "old", name: "Old", startedAt: "2026-02-02T09:00:00.000Z", endedAt: "2026-02-02T10:00:00.000Z", exercises: [] }], meals: [], sleep: [], measurements: [], journal: [] },
    });
    const old = (await getAllSessions()).find((s) => s.id === "old");
    expect(old?.date).toBe("2026-02-02");
  });
  it("logs started and finished once each", async () => {
    await saveSession(mk("e1", "2026-03-02"));
    await saveSession(mk("e1", "2026-03-02", { exercises: [] }));
    await saveSession(mk("e1", "2026-03-02", { endedAt: "2026-03-02T11:00:00.000Z" }));
    await saveSession(mk("e1", "2026-03-02", { endedAt: "2026-03-02T11:00:00.000Z", notes: "x" }));
    const events = await getEvents();
    const mine = events.filter((e) => (e.payload as { workoutId?: string }).workoutId === "e1");
    expect(mine.filter((e) => e.type === "workout.started").length).toBe(1);
    expect(mine.filter((e) => e.type === "workout.finished").length).toBe(1);
  });
  it("finished sessions feed existing consumers", async () => {
    await saveSession(mk("c1", "2026-03-03", { ...worked, endedAt: "2026-03-03T11:00:00.000Z" }));
    expect((await getCompletedWorkouts()).some((s) => s.id === "c1")).toBe(true);
  });
  it("moving a session's date moves it between days", async () => {
    await saveSession(mk("m1", "2026-03-04"));
    await saveSession(mk("m1", "2026-03-05"));
    const found = (await getAllSessions()).filter((s) => s.id === "m1");
    expect(found.length).toBe(1);
    expect(found[0].date).toBe("2026-03-05");
  });
  it("delete removes it and tombstones the timeline", async () => {
    await saveSession(mk("d1", "2026-03-06", { endedAt: "2026-03-06T11:00:00.000Z" }));
    expect(await deleteSession("d1")).toBe(true);
    expect(await deleteSession("d1")).toBe(false);
    expect((await getAllSessions()).some((s) => s.id === "d1")).toBe(false);
    const tl = await getTimeline();
    expect(JSON.stringify(tl)).not.toContain("d1");
  });
  it("reopen then re-finish leaves one timeline entry", async () => {
    await saveSession(mk("r1", "2026-03-07", { ...worked, endedAt: "2026-03-07T11:00:00.000Z" }));
    await saveSession(mk("r1", "2026-03-07", worked));
    await saveSession(mk("r1", "2026-03-07", { ...worked, endedAt: "2026-03-07T11:30:00.000Z" }));
    const tl = await getTimeline();
    expect(JSON.stringify(tl).split('"r1"').length - 1).toBeLessThanOrEqual(1);
  });
  it("concurrent saves lose nothing", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => saveSession(mk(`k${i}`, "2026-03-08"))));
    const ids = (await getAllSessions()).map((s) => s.id);
    for (let i = 0; i < 8; i++) expect(ids).toContain(`k${i}`);
  });
});

describe("forge settings repository", () => {
  it("imports routines into a plan once, never touching them", async () => {
    await createRoutine("Push", undefined, [{ exerciseId: "bench-press", name: "Bench Press", order: 0 }]);
    const first = await getForgeSettings();
    expect(first.routinesImported).toBe(true);
    expect(first.plans.length).toBe(1);
    expect(first.plans[0].days[0].name).toBe("Push");
    await createRoutine("Pull", undefined, [{ exerciseId: "x", name: "Row", order: 0 }]);
    const second = await getForgeSettings();
    expect(second.plans.length).toBe(1);
  });
  it("updates are atomic", async () => {
    await Promise.all(Array.from({ length: 10 }, () => updateForgeSettings((s) => ({ ...s, restSeconds: s.restSeconds + 1 }))));
    const s = await getForgeSettings();
    expect(s.restSeconds).toBe(90 + 10);
  });
  it("normalizes on write", async () => {
    const s = await updateForgeSettings((cur) => ({ ...cur, restSeconds: 99999, barKg: 0 }));
    expect(s.restSeconds).toBe(600);
    expect(s.barKg).toBe(20);
  });
});

describe("custom exercises", () => {
  it("adds, dedupes by name, deletes", async () => {
    const a = await addCustomExercise("Zottman", "Arms", false);
    const b = await addCustomExercise("zottman", "Arms", false);
    expect(a?.id).toBe(b?.id);
    expect(await addCustomExercise("  ", "Arms", false)).toBeNull();
    await deleteCustomExercise(a!.id);
    expect((await getCustomExercises()).length).toBe(0);
  });
});
