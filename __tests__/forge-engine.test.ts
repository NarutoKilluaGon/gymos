import { buildExercise, buildSession, bottomReps, topReps } from "@/services/forge/build";
import { buildCatalog, findExercise } from "@/services/forge/catalog";
import { detectPrs, previousSets } from "@/services/forge/history";
import { convert, formatSet, loadKg, score, sessionVolumeKg, toKg } from "@/services/forge/load";
import { addSet, setCounts, toggleSet, toggleWarmup } from "@/services/forge/ops";
import { nextRotationDay, newPlan, newDay, scheduledDay } from "@/services/forge/plan";
import { platesFor } from "@/services/forge/plates";
import { normalizeForgeSettings } from "@/services/forge/settings";
import { IDLE_GRACE_MS, durationMs, finish, pause, reopen, resume } from "@/services/forge/timing";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";

let n = 0;
const id = () => `id${++n}`;
const set = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: id(), weight, reps, unit: "kg", completed: true, ...extra,
});
const ex = (exerciseId: string, sets: WorkoutSet[], extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: id(), exerciseId, name: exerciseId, sets, ...extra,
});
const session = (date: string, exercises: WorkoutExercise[], extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: id(), name: "S", startedAt: `${date}T10:00:00.000Z`, endedAt: `${date}T11:00:00.000Z`, date, exercises, ...extra,
});

describe("load maths", () => {
  it("converts units", () => {
    expect(Math.round(toKg(100, "lb") * 10) / 10).toBe(45.4);
    expect(Math.round(convert(45.4, "kg", "lb"))).toBe(100);
  });
  it("Epley score", () => {
    expect(score({}, { bodyweight: false }, set(60, 30))).toBe(120);
    expect(score({}, { bodyweight: false }, set(0, 12))).toBe(12);
  });
  it("bodyweight load adds body weight and clamps at zero", () => {
    expect(loadKg({ bodyweightKg: 80 }, { bodyweight: true }, set(10, 5))).toBe(90);
    expect(loadKg({ bodyweightKg: 80 }, { bodyweight: true }, set(-200, 5))).toBe(0);
    expect(loadKg({}, { bodyweight: true }, set(0, 5))).toBe(70);
  });
  it("volume skips warm-ups and undone sets", () => {
    const s = session("2026-01-01", [ex("a", [set(50, 10), set(20, 10, { warmup: true }), set(50, 10, { completed: false })])]);
    expect(sessionVolumeKg(s)).toBe(500);
  });
  it("formats sets", () => {
    expect(formatSet({ bodyweight: false }, set(60, 8), "kg")).toBe("60×8");
    expect(formatSet({ bodyweight: true }, set(0, 12), "kg")).toBe("BW×12");
    expect(formatSet({ bodyweight: true }, set(10, 5), "kg")).toBe("BW+10×5");
    expect(formatSet({ bodyweight: true }, set(-20, 6), "kg")).toBe("BW−20×6");
  });
});

describe("catalog", () => {
  it("merges library and custom, resolves aliases, keeps core ids", () => {
    const catalog = buildCatalog([{ id: "custom-1", name: "Zottman Curl", muscleGroup: "Arms", bodyweight: false }]);
    expect(findExercise(catalog, "custom-1")?.name).toBe("Zottman Curl");
    expect(catalog.length).toBeGreaterThan(48);
    const ids = catalog.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("rep targets", () => {
  it("parses ranges", () => {
    expect(topReps("8-10")).toBe(10);
    expect(bottomReps("8-10")).toBe(8);
    expect(topReps("5")).toBe(5);
    expect(topReps(undefined)).toBe(0);
  });
});

describe("build / progression / deload", () => {
  const bench = { id: "bench", name: "Bench", bodyweight: false };
  const target = { sets: 3, reps: "8-10", weight: 60 };

  it("prefills from the plan with no history", () => {
    const e = buildExercise({ exercise: bench, target, previous: null, deload: false, unit: "kg", newId: id });
    expect(e.sets.length).toBe(3);
    expect(e.sets[0]).toMatchObject({ weight: 60, reps: 8, completed: false });
  });
  it("progresses when every set hit the top of the range", () => {
    const prev = [set(60, 10), set(60, 10), set(60, 10)];
    const e = buildExercise({ exercise: bench, target, previous: prev, deload: false, unit: "kg", newId: id });
    expect(e.progressed).toBe(true);
    expect(e.sets[0]).toMatchObject({ weight: 62.5, reps: 8 });
  });
  it("does not progress if one set missed", () => {
    const prev = [set(60, 10), set(60, 9), set(60, 10)];
    const e = buildExercise({ exercise: bench, target, previous: prev, deload: false, unit: "kg", newId: id });
    expect(e.progressed).toBeUndefined();
    expect(e.sets[1]).toMatchObject({ weight: 60, reps: 9 });
  });
  it("lb steps by 5", () => {
    const prev = [set(135, 10, { unit: "lb" })];
    const e = buildExercise({ exercise: bench, target: { ...target, sets: 1 }, previous: prev, deload: false, unit: "lb", newId: id });
    expect(e.sets[0].weight).toBe(140);
  });
  it("deload cuts sets and load, never progresses", () => {
    const prev = [set(100, 10), set(100, 10), set(100, 10), set(100, 10), set(100, 10)];
    const e = buildExercise({ exercise: bench, target: { ...target, sets: 5 }, previous: prev, deload: true, unit: "kg", newId: id });
    expect(e.sets.length).toBe(3);
    expect(e.sets[0].weight).toBe(90);
    expect(e.progressed).toBeUndefined();
  });
  it("deload keeps at least 2 sets", () => {
    const e = buildExercise({ exercise: bench, target: { ...target, sets: 2 }, previous: null, deload: true, unit: "kg", newId: id });
    expect(e.sets.length).toBe(2);
  });
  it("backdated sessions sit at noon with no duration", () => {
    const s = buildSession({ name: "x", date: "2026-02-03", exercises: [], backdated: true, newId: id });
    expect(s.backdated).toBe(true);
    expect(new Date(s.startedAt).getHours()).toBe(12);
  });
});

describe("history and PRs", () => {
  it("first session is never a PR", () => {
    const first = session("2026-01-01", [ex("bench", [set(100, 5)])]);
    expect(detectPrs([first], first)).toEqual([]);
  });
  it("beating history is a PR; matching is not", () => {
    const a = session("2026-01-01", [ex("bench", [set(100, 5)])]);
    const b = session("2026-01-08", [ex("bench", [set(100, 6)])]);
    const c = session("2026-01-15", [ex("bench", [set(100, 5)])]);
    expect(detectPrs([a, b, c], b).length).toBe(1);
    expect(detectPrs([a, b, c], c)).toEqual([]);
  });
  it("warm-ups never make a PR", () => {
    const a = session("2026-01-01", [ex("bench", [set(60, 5)])]);
    const b = session("2026-01-08", [ex("bench", [set(60, 5), set(200, 5, { warmup: true })])]);
    expect(detectPrs([a, b], b)).toEqual([]);
  });
  it("bodyweight: more reps beats, same does not", () => {
    const a = session("2026-01-01", [ex("pull", [set(0, 8)], { bodyweight: true })], { bodyweightKg: 80 });
    const b = session("2026-01-08", [ex("pull", [set(0, 9)], { bodyweight: true })], { bodyweightKg: 80 });
    const c = session("2026-01-15", [ex("pull", [set(0, 8)], { bodyweight: true })], { bodyweightKg: 80 });
    expect(detectPrs([a, b], b).length).toBe(1);
    expect(detectPrs([a, c], c)).toEqual([]);
  });
  it("previousSets finds the latest earlier performance", () => {
    const a = session("2026-01-01", [ex("bench", [set(50, 5)])]);
    const b = session("2026-01-08", [ex("bench", [set(55, 5)])]);
    const now = session("2026-01-15", [], { endedAt: undefined });
    expect(previousSets([a, b], "bench", now)?.sets[0].weight).toBe(55);
  });
  it("unfinished sessions are not history", () => {
    const a = session("2026-01-01", [ex("bench", [set(50, 5)])], { endedAt: undefined });
    const now = session("2026-01-15", [], { endedAt: undefined });
    expect(previousSets([a], "bench", now)).toBeNull();
  });
});

describe("ops", () => {
  const base = () => session("2026-01-01", [ex("a", [set(50, 5, { completed: false })])], { endedAt: undefined, lastActivityAt: "2026-01-01T10:00:00.000Z" });
  const t = new Date("2026-01-01T10:10:00.000Z");

  it("ticking starts rest; unticking does not", () => {
    const r = toggleSet(base(), 0, 0, t);
    expect(r.startRest).toBe(true);
    expect(r.session.exercises[0].sets[0].completed).toBe(true);
    expect(toggleSet(r.session, 0, 0, t).startRest).toBe(false);
  });
  it("mid-superset tick starts no rest", () => {
    const s = base();
    s.exercises = [ex("a", [set(1, 1, { completed: false })], { group: "g" }), ex("b", [set(1, 1, { completed: false })], { group: "g" })];
    expect(toggleSet(s, 0, 0, t).startRest).toBe(false);
    expect(toggleSet(s, 1, 0, t).startRest).toBe(true);
  });
  it("ticking while paused resumes the clock", () => {
    const s = { ...base(), pausedAt: "2026-01-01T10:05:00.000Z" };
    const r = toggleSet(s, 0, 0, t).session;
    expect(r.pausedAt).toBeUndefined();
    expect(r.pausedMs).toBe(5 * 60_000);
  });
  it("warm-up toggle and counts", () => {
    let s = addSet(base(), 0, t);
    s = toggleWarmup(s, 0, 0, t);
    expect(s.exercises[0].sets[0].warmup).toBe(true);
    expect(setCounts(s).total).toBe(1);
  });
  it("ops on bad indexes are no-ops", () => {
    const s = base();
    expect(toggleSet(s, 5, 5, t).session).toBe(s);
  });
});

describe("timing", () => {
  const open = (): WorkoutSession => session("2026-01-01", [], { endedAt: undefined, startedAt: "2026-01-01T10:00:00.000Z", lastActivityAt: "2026-01-01T10:50:00.000Z" });

  it("active time excludes pauses", () => {
    let s = pause(open(), new Date("2026-01-01T10:20:00.000Z"));
    s = resume(s, new Date("2026-01-01T10:30:00.000Z"));
    expect(durationMs(s, new Date("2026-01-01T10:40:00.000Z").getTime())).toBe(30 * 60_000);
  });
  it("finish sets endedAt = start + active duration", () => {
    const { session: s, trimmed } = finish(open(), new Date("2026-01-01T10:55:00.000Z"));
    expect(trimmed).toBe(false);
    expect(s.durationMs).toBe(55 * 60_000);
    expect(s.endedAt).toBe("2026-01-01T10:55:00.000Z");
  });
  it("idle 30+ min trims to last activity + 5 min", () => {
    const { session: s, trimmed } = finish(open(), new Date("2026-01-01T12:00:00.000Z"));
    expect(trimmed).toBe(true);
    expect(s.durationMs).toBe(50 * 60_000 + IDLE_GRACE_MS);
  });
  it("finishing while paused ends at the pause", () => {
    const p = pause(open(), new Date("2026-01-01T10:30:00.000Z"));
    const { session: s } = finish(p, new Date("2026-01-01T13:00:00.000Z"));
    expect(s.durationMs).toBe(30 * 60_000);
    expect(s.pausedAt).toBeUndefined();
  });
  it("backdated finish has zero duration", () => {
    const b = buildSession({ name: "x", date: "2026-01-01", exercises: [], backdated: true, newId: id });
    expect(finish(b, new Date()).session.durationMs).toBe(0);
  });
  it("reopen continues from the stored duration", () => {
    const done = finish(open(), new Date("2026-01-01T10:55:00.000Z")).session;
    const later = new Date("2026-01-01T11:30:00.000Z");
    const re = reopen(done, later);
    expect(re.endedAt).toBeUndefined();
    expect(durationMs(re, later.getTime())).toBe(55 * 60_000);
  });
});

describe("plans", () => {
  it("weekday schedule and rotation", () => {
    const plan = newPlan("P", new Date("2026-01-01T00:00:00Z"), id);
    const a = newDay("A", id);
    const b = newDay("B", id);
    plan.days = [a, b];
    plan.schedule = { "4": b.id };
    expect(scheduledDay(plan, "2026-01-01")?.name).toBe("B");
    expect(scheduledDay(plan, "2026-01-02")).toBeNull();
    expect(nextRotationDay(plan, [])?.name).toBe("A");
    const done = session("2026-01-01", [], { planId: plan.id, dayId: a.id });
    expect(nextRotationDay(plan, [done])?.name).toBe("B");
    const done2 = session("2026-01-02", [], { planId: plan.id, dayId: b.id });
    expect(nextRotationDay(plan, [done, done2])?.name).toBe("A");
  });
});

describe("plates", () => {
  it("loads one side greedily", () => {
    expect(platesFor(100, 20, "kg").perSide).toEqual([25, 15]);
    expect(platesFor(20, 20, "kg").perSide).toEqual([]);
    expect(platesFor(15, 20, "kg").belowBar).toBe(true);
    expect(platesFor(61, 20, "kg").leftover).toBe(1);
  });
});

describe("settings normalisation", () => {
  it("survives garbage", () => {
    expect(normalizeForgeSettings(null).plans).toEqual([]);
    const s = normalizeForgeSettings({
      plans: [
        { id: "p", name: "P", days: [{ id: "d", name: "D", exercises: [{ exerciseId: "x", name: "X", sets: 99, reps: "", weight: -5 }, { bogus: 1 }] }, 7], schedule: { "1": "d", "9": "d", "2": "missing" } },
        "bad",
      ],
      activePlanId: "nope",
      restSeconds: 9999,
      barKg: -1,
    });
    expect(s.plans.length).toBe(1);
    expect(s.activePlanId).toBe("p");
    expect(s.plans[0].days[0].exercises).toEqual([{ exerciseId: "x", name: "X", sets: 20, reps: "8-10", weight: 0 }]);
    expect(s.plans[0].schedule).toEqual({ "1": "d" });
    expect(s.restSeconds).toBe(600);
    expect(s.barKg).toBe(20);
  });
});
