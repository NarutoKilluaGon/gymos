import { getHomeSuggestion } from "@/services/dashboard/suggestions";
import type { PlanDay } from "@/types/forge";
import type { WorkoutSession } from "@/types/gymos";

const planDay: PlanDay = {
  id: "d1",
  name: "Upper Body",
  exercises: [
    { exerciseId: "bench", name: "Bench press", sets: 3, reps: "8-10", weight: 60 },
  ],
};

const openWorkout: WorkoutSession = {
  id: "w1",
  name: "Live Session",
  startedAt: "2026-03-01T09:00:00.000Z",
  exercises: [
    {
      id: "e1",
      exerciseId: "bench",
      name: "Bench Press",
      sets: [{ id: "s1", reps: 10, weight: 60, completed: true }],
    },
  ],
};

const finishedWorkout: WorkoutSession = {
  id: "w1",
  name: "Finished Session",
  startedAt: "2026-03-01T09:00:00.000Z",
  endedAt: "2026-03-01T09:50:00.000Z",
  exercises: [],
};

describe("Home suggestions", () => {
  it("prioritizes active workout regardless of hour", () => {
    const morning = getHomeSuggestion({
      activeWorkout: openWorkout,
      currentHour: 9,
    });
    expect(morning.text).toBe("Continue your workout — 1 exercise logged.");
    expect(morning.action.route).toBe("/workouts");

    const night = getHomeSuggestion({
      activeWorkout: openWorkout,
      currentHour: 22,
    });
    expect(night.text).toBe("Continue your workout — 1 exercise logged.");
  });

  it("suggests planned workout before 8 pm (20:00) when not finished", () => {
    const at9am = getHomeSuggestion({
      plannedDay: planDay,
      finishedWorkout: null,
      currentHour: 9,
      waterLitres: 1.0,
      sleep: [{ id: "sl1", startedAt: "2026-03-01T23:00:00.000Z", endedAt: "2026-03-02T07:00:00.000Z" }],
    });
    expect(at9am.text).toBe("Today: Upper Body · 1 exercise ready");
    expect(at9am.action.route).toBe("/workouts");

    const at4pm = getHomeSuggestion({
      plannedDay: planDay,
      finishedWorkout: null,
      currentHour: 16,
      protein: 140,
      proteinTarget: 150,
      waterLitres: 2.5,
    });
    expect(at4pm.text).toBe("Today: Upper Body · 1 exercise ready");
  });

  it("at 4 pm after workout, prioritizes protein gap >= 30g", () => {
    const res = getHomeSuggestion({
      plannedDay: planDay,
      finishedWorkout,
      protein: 60,
      proteinTarget: 150,
      currentHour: 16,
      waterLitres: 2.5,
    });
    expect(res.text).toContain("90g protein to go");
    expect(res.action.route).toBe("/nutrition");
  });

  it("never says 'start your day' after noon", () => {
    const at4pm = getHomeSuggestion({
      finishedWorkout,
      waterLitres: 0,
      currentHour: 16,
      protein: 150,
      proteinTarget: 150,
    });
    expect(at4pm.text).not.toContain("Start your day");
    expect(at4pm.text).toContain("water to go today");

    const at9am = getHomeSuggestion({
      finishedWorkout,
      waterLitres: 0,
      currentHour: 9,
    });
    expect(at9am.text).toBe("Start your day with a glass of water.");
  });

  it("at 10 pm when workout and targets are met, shows on track", () => {
    const at10pm = getHomeSuggestion({
      finishedWorkout,
      waterLitres: 3.5,
      protein: 150,
      proteinTarget: 150,
      currentHour: 22,
    });
    expect(at10pm.text).toBe("You're on track today.");
    expect(at10pm.action.route).toBe("/hub");
  });

  it("in morning before noon with no sleep logged, asks about sleep", () => {
    const res = getHomeSuggestion({
      finishedWorkout,
      waterLitres: 1.0,
      sleep: [],
      currentHour: 9,
    });
    expect(res.text).toBe("How did you sleep?");
    expect(res.action.type).toBe("sleep");
  });
});
