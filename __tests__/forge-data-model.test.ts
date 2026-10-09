import {
  AMRAP_PROGRESSION_MARGIN,
  bottomReps,
  buildExercise,
  parseRepTarget,
  topReps,
} from "@/services/forge/build";
import {
  cleanSearchToken,
  exerciseMatchesQuery,
  findSimilarExercise,
  normalizeName,
} from "@/services/forge/catalog";
import { muscleBalance, perMuscleBreakdown } from "@/services/forge/balance";
import { MUSCLES_BY_GROUP, normalizeMuscleName } from "@/data/muscles";
import type { CatalogExercise } from "@/types/forge";
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from "@/types/gymos";

let n = 0;
const id = () => `id${++n}`;

const set = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: id(),
  weight,
  reps,
  unit: "kg",
  completed: true,
  ...extra,
});

const ex = (exerciseId: string, sets: WorkoutSet[], extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: id(),
  exerciseId,
  name: exerciseId,
  sets,
  ...extra,
});

const session = (date: string, exercises: WorkoutExercise[], extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: id(),
  name: "Session",
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  date,
  exercises,
  ...extra,
});

describe("Part 5a: Rep Target Parsing & Progression", () => {
  it("parses fixed, range, and AMRAP variations accurately", () => {
    expect(parseRepTarget("8")).toEqual({ kind: "fixed", min: 8, max: 8 });
    expect(parseRepTarget("8-10")).toEqual({ kind: "range", min: 8, max: 10 });
    expect(parseRepTarget("8 - 12")).toEqual({ kind: "range", min: 8, max: 12 });
    expect(parseRepTarget("8+")).toEqual({ kind: "amrap", min: 8 });
    expect(parseRepTarget("AMRAP")).toEqual({ kind: "amrap" });
    expect(parseRepTarget("failure")).toEqual({ kind: "amrap" });
    expect(parseRepTarget("to failure")).toEqual({ kind: "amrap" });
    expect(parseRepTarget("F")).toEqual({ kind: "amrap" });
    expect(parseRepTarget("f")).toEqual({ kind: "amrap" });
    expect(parseRepTarget("")).toEqual({ kind: "fixed", min: 0, max: 0 });
  });

  it("extracts top and bottom reps correctly", () => {
    expect(topReps("8-10")).toBe(10);
    expect(bottomReps("8-10")).toBe(8);

    expect(topReps("8+")).toBe(8);
    expect(bottomReps("8+")).toBe(8);

    expect(topReps("AMRAP")).toBe(0);
    expect(bottomReps("AMRAP")).toBe(0);
  });

  it("progresses fixed reps when every set hits the target", () => {
    const bench = { id: "bench", name: "Bench", bodyweight: false };
    const target = { sets: 3, reps: "5", weight: 80 };
    const prev = [set(80, 5), set(80, 5), set(80, 5)];

    const built = buildExercise({
      exercise: bench,
      target,
      previous: prev,
      deload: false,
      unit: "kg",
      newId: id,
    });

    expect(built.progressed).toBe(true);
    expect(built.sets[0].weight).toBe(82.5);
    expect(built.sets[0].reps).toBe(5);
  });

  it("progresses range reps when every set hits the upper bound", () => {
    const bench = { id: "bench", name: "Bench", bodyweight: false };
    const target = { sets: 3, reps: "8-10", weight: 60 };
    const prev = [set(60, 10), set(60, 10), set(60, 10)];

    const built = buildExercise({
      exercise: bench,
      target,
      previous: prev,
      deload: false,
      unit: "kg",
      newId: id,
    });

    expect(built.progressed).toBe(true);
    expect(built.sets[0].weight).toBe(62.5);
    expect(built.sets[0].reps).toBe(8);
  });

  it("AMRAP with minimum: progresses when every set reaches min + AMRAP_PROGRESSION_MARGIN (2)", () => {
    const bench = { id: "bench", name: "Bench", bodyweight: false };
    const target = { sets: 3, reps: "8+", weight: 70 };
    expect(AMRAP_PROGRESSION_MARGIN).toBe(2);

    // Reached 8+2 = 10 on all sets -> should progress
    const prevSuccess = [set(70, 10), set(70, 10), set(70, 11)];
    const builtSuccess = buildExercise({
      exercise: bench,
      target,
      previous: prevSuccess,
      deload: false,
      unit: "kg",
      newId: id,
    });
    expect(builtSuccess.progressed).toBe(true);
    expect(builtSuccess.sets[0].weight).toBe(72.5);
    expect(builtSuccess.sets[0].reps).toBe(8);

    // Reached only 9 on one set (< 10) -> does NOT progress
    const prevMiss = [set(70, 10), set(70, 9), set(70, 10)];
    const builtMiss = buildExercise({
      exercise: bench,
      target,
      previous: prevMiss,
      deload: false,
      unit: "kg",
      newId: id,
    });
    expect(builtMiss.progressed).toBeUndefined();
    expect(builtMiss.sets[0].weight).toBe(70);
  });

  it("AMRAP without minimum: never auto-progresses", () => {
    const bench = { id: "bench", name: "Bench", bodyweight: false };
    const target = { sets: 3, reps: "AMRAP", weight: 70 };
    const prev = [set(70, 15), set(70, 20), set(70, 25)];

    const built = buildExercise({
      exercise: bench,
      target,
      previous: prev,
      deload: false,
      unit: "kg",
      newId: id,
    });

    expect(built.progressed).toBeUndefined();
    expect(built.sets[0].weight).toBe(70);
  });

  it("WorkoutSet supports optional toFailure flag", () => {
    const s: WorkoutSet = {
      id: "set-1",
      reps: 10,
      weight: 100,
      completed: true,
      toFailure: true,
    };
    expect(s.toFailure).toBe(true);
  });
});

describe("Part 5b: Muscles Hierarchy & Balance Breakdown", () => {
  it("MUSCLES_BY_GROUP contains the 6 canonical groups", () => {
    expect(Object.keys(MUSCLES_BY_GROUP)).toEqual([
      "Chest",
      "Back",
      "Shoulders",
      "Arms",
      "Legs",
      "Core",
    ]);
    expect(MUSCLES_BY_GROUP.Chest).toContain("Upper Chest");
    expect(MUSCLES_BY_GROUP.Back).toContain("Lats");
    expect(MUSCLES_BY_GROUP.Arms).toContain("Biceps");
  });

  it("normalizeMuscleName normalizes anatomical and shorthand terms", () => {
    expect(normalizeMuscleName("pectoralis major")).toBe("Pectoralis Major");
    expect(normalizeMuscleName("latissimus dorsi")).toBe("Lats");
    expect(normalizeMuscleName("front delt")).toBe("Front Delts");
    expect(normalizeMuscleName("bicep")).toBe("Biceps");
    expect(normalizeMuscleName("quads")).toBe("Quads");
  });

  it("computes muscle balance with per-muscle breakdown", () => {
    const catalog: CatalogExercise[] = [
      {
        id: "bench",
        name: "Bench Press",
        muscleGroup: "Chest",
        bodyweight: false,
        primaryMuscles: ["Upper Chest", "Mid Chest"],
      },
      {
        id: "pullup",
        name: "Pull-up",
        muscleGroup: "Back",
        bodyweight: true,
        primaryMuscles: ["Lats"],
      },
    ];

    const s = session("2026-03-01", [
      ex("bench", [set(80, 8), set(80, 8)]),
      ex("pullup", [set(0, 10), set(0, 10), set(0, 10)]),
    ]);

    const now = new Date("2026-03-02T12:00:00Z");
    const shares = muscleBalance([s], catalog, 30, now);

    const chestShare = shares.find((item) => item.group === "Chest");
    expect(chestShare?.sets).toBe(2);
    expect(chestShare?.muscles["Upper Chest"]).toBe(2);
    expect(chestShare?.muscles["Mid Chest"]).toBe(2);

    const backShare = shares.find((item) => item.group === "Back");
    expect(backShare?.sets).toBe(3);
    expect(backShare?.muscles["Lats"]).toBe(3);

    const totalBreakdown = perMuscleBreakdown([s], catalog, 30, now);
    expect(totalBreakdown["Upper Chest"]).toBe(2);
    expect(totalBreakdown["Lats"]).toBe(3);
  });
});

describe("Part 5c: Load Types", () => {
  it("supports load types on catalog exercises", () => {
    const entry: CatalogExercise = {
      id: "ex-1",
      name: "Barbell Squat",
      muscleGroup: "Legs",
      bodyweight: false,
      loadType: "barbell",
    };
    expect(entry.loadType).toBe("barbell");
  });
});

describe("Part 5d: Search, Aliases & Duplicate Detection", () => {
  it("normalizes search tokens and aliases", () => {
    expect(cleanSearchToken("Lat-Pulldown!")).toBe("lat pulldown");
    expect(cleanSearchToken("Curls")).toBe("curl");
    expect(normalizeName("lat pull")).toBe("lat pulldown");
    expect(normalizeName("hyperextension")).toBe("back extension");
    expect(normalizeName("skullcrusher")).toBe("skull crusher");
    expect(normalizeName("rdl")).toBe("romanian deadlift");
    expect(normalizeName("bench")).toBe("bench press");
  });

  it("matches query against exercise name and aliases", () => {
    const entry: CatalogExercise = {
      id: "back-ext",
      name: "Back Extension",
      muscleGroup: "Back",
      bodyweight: true,
      aliases: ["hyperextension", "hyperextensions"],
    };

    expect(exerciseMatchesQuery(entry, "hyperextension")).toBe(true);
    expect(exerciseMatchesQuery(entry, "back extension")).toBe(true);
    expect(exerciseMatchesQuery(entry, "squat")).toBe(false);
  });

  it("finds near duplicate candidates for duplicate warnings", () => {
    const catalog: CatalogExercise[] = [
      {
        id: "back-ext",
        name: "Back Extension",
        muscleGroup: "Back",
        bodyweight: true,
        aliases: ["hyperextension", "hyperextensions"],
      },
      {
        id: "bench-press",
        name: "Bench Press",
        muscleGroup: "Chest",
        bodyweight: false,
        aliases: ["bench"],
      },
    ];

    expect(findSimilarExercise(catalog, "hyperextension")?.name).toBe("Back Extension");
    expect(findSimilarExercise(catalog, "Bench")?.name).toBe("Bench Press");
    expect(findSimilarExercise(catalog, "Incline Fly")).toBeUndefined();
  });
});
