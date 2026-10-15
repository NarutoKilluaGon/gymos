import { buildHomeSummarySentence } from "@/services/dashboard/home-sentence";

describe("buildHomeSummarySentence", () => {
  it("formats sentence when active workout and over calorie budget", () => {
    const text = buildHomeSummarySentence({
      activeWorkout: true,
      caloriesEaten: 3445,
      calorieTarget: 2258,
    });
    expect(text).toBe("One workout is open and you're 1,187 kcal over today's budget.");
  });

  it("formats sentence when workout complete and over calorie budget", () => {
    const text = buildHomeSummarySentence({
      workoutDone: true,
      caloriesEaten: 3445,
      calorieTarget: 2258,
    });
    expect(text).toBe("Workout complete. You're 1,187 kcal over today's budget.");
  });

  it("formats sentence when active workout with title and under budget", () => {
    const text = buildHomeSummarySentence({
      activeWorkout: true,
      workoutTitle: "Push",
      caloriesEaten: 1550,
      calorieTarget: 2000,
    });
    expect(text).toBe("Push workout open · 450 kcal remaining today.");
  });

  it("formats sentence when rest day / no workout and under budget", () => {
    const text = buildHomeSummarySentence({
      caloriesEaten: 1200,
      calorieTarget: 2000,
    });
    expect(text).toBe("800 kcal remaining today.");
  });

  it("formats sentence when all targets on track / starting fresh", () => {
    const text = buildHomeSummarySentence({});
    expect(text).toBe("All targets on track today.");
  });
});
