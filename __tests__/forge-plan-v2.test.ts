import {
  duplicateDay,
  moveExercise as movePlanExercise,
  movePlanExerciseDown,
  movePlanExerciseUp,
  newDay,
  newPlan,
  planExerciseFor,
} from "@/services/forge/plan";
import { moveExercise as moveSessionExercise } from "@/services/forge/ops";
import { parseRepTarget } from "@/services/forge/build";
import type { Plan, PlanExercise } from "@/types/forge";
import type { WorkoutExercise, WorkoutSession } from "@/types/gymos";

const ex = (id: string, overrides: Partial<PlanExercise> = {}): PlanExercise => ({
  exerciseId: id,
  name: id,
  sets: 3,
  reps: "8-10",
  weight: 50,
  ...overrides,
});

const basePlan = (): Plan => {
  const plan = newPlan("P1", new Date("2026-03-01T00:00:00Z"));
  const day = newDay("Push");
  day.id = "d1";
  day.exercises = [
    ex("bench", { superset: true }),
    ex("flyes"),
    ex("ohp"),
    ex("lateral"),
  ];
  plan.days = [day];
  return plan;
};

describe("Plan ops v2", () => {
  describe("duplicateDay", () => {
    it("creates a deep copy of a day with '(Copy)' suffix", () => {
      const plan = basePlan();
      const updated = duplicateDay(plan, "d1", new Date("2026-03-01T01:00:00Z"));
      expect(updated.days).toHaveLength(2);
      expect(updated.days[0].name).toBe("Push");
      expect(updated.days[1].name).toBe("Push (Copy)");
      expect(updated.days[1].id).not.toBe(updated.days[0].id);
      expect(updated.days[1].exercises).toHaveLength(4);
    });

    it("returns unchanged if day id not found", () => {
      const plan = basePlan();
      const updated = duplicateDay(plan, "nonexistent", new Date());
      expect(updated.days).toHaveLength(1);
    });
  });

  describe("moveExercise (plan)", () => {
    it("moves an exercise from index 2 to index 0", () => {
      const plan = basePlan(); // [bench(superset), flyes, ohp, lateral]
      const updated = movePlanExercise(plan, "d1", 2, 0, new Date());
      const ids = updated.days[0].exercises.map((e) => e.exerciseId);
      expect(ids).toEqual(["ohp", "bench", "flyes", "lateral"]);
      // bench and flyes were still adjacent, so bench retains superset!
      expect(updated.days[0].exercises[1].superset).toBe(true);
    });

    it("unlinks superset when leader is dragged away", () => {
      const plan = basePlan(); // [bench(superset), flyes, ohp, lateral]
      // Move bench (index 0) to index 3 (end)
      const updated = movePlanExercise(plan, "d1", 0, 3, new Date());
      const ids = updated.days[0].exercises.map((e) => e.exerciseId);
      expect(ids).toEqual(["flyes", "ohp", "lateral", "bench"]);
      // bench is separated from flyes -> superset unlinked
      expect(updated.days[0].exercises[3].superset).toBe(false);
    });

    it("unlinks superset when partner is dragged away", () => {
      const plan = basePlan(); // [bench(superset), flyes, ohp, lateral]
      // Move flyes (index 1) to index 3 (end)
      const updated = movePlanExercise(plan, "d1", 1, 3, new Date());
      const ids = updated.days[0].exercises.map((e) => e.exerciseId);
      expect(ids).toEqual(["bench", "ohp", "lateral", "flyes"]);
      // bench is no longer adjacent to flyes -> bench superset unlinked
      expect(updated.days[0].exercises[0].superset).toBe(false);
    });

    it("movePlanExerciseDown moves index to index + 1", () => {
      const plan = basePlan();
      const updated = movePlanExerciseDown(plan, "d1", 1, new Date());
      const ids = updated.days[0].exercises.map((e) => e.exerciseId);
      expect(ids).toEqual(["bench", "ohp", "flyes", "lateral"]);
    });

    it("movePlanExerciseUp moves index to index - 1", () => {
      const plan = basePlan();
      const updated = movePlanExerciseUp(plan, "d1", 2, new Date());
      const ids = updated.days[0].exercises.map((e) => e.exerciseId);
      expect(ids).toEqual(["bench", "ohp", "flyes", "lateral"]);
    });
  });

  describe("moveExercise (session)", () => {
    it("moves session exercise and drops orphan superset groups", () => {
      const sEx = (id: string, group?: string): WorkoutExercise => ({
        id,
        exerciseId: id,
        name: id,
        sets: [],
        ...(group ? { group } : {}),
      });

      const session: WorkoutSession = {
        id: "s1",
        date: "2026-03-01",
        startedAt: "2026-03-01T00:00:00Z",
        name: "Workout",
        exercises: [
          sEx("e1", "grp1"),
          sEx("e2", "grp1"),
          sEx("e3"),
          sEx("e4"),
        ],
      };

      // Moving e1 to end separates grp1
      const updated = moveSessionExercise(session, 0, 3, new Date());
      expect(updated.exercises.map((e) => e.exerciseId)).toEqual(["e2", "e3", "e4", "e1"]);
      expect(updated.exercises[0].group).toBeUndefined();
      expect(updated.exercises[3].group).toBeUndefined();
    });
  });

  describe("parseRepTarget expressions in plan editor", () => {
    it("handles ranges, amrap, and fixed targets", () => {
      expect(parseRepTarget("8-10")).toEqual({ kind: "range", min: 8, max: 10 });
      expect(parseRepTarget("8+")).toEqual({ kind: "amrap", min: 8 });
      expect(parseRepTarget("AMRAP")).toEqual({ kind: "amrap" });
      expect(parseRepTarget("5")).toEqual({ kind: "fixed", min: 5, max: 5 });
    });
  });
});
