import { buildHomeSummarySentence } from "@/services/dashboard/home-sentence";

describe("buildHomeSummarySentence (10-level priority)", () => {
  it("case 1: active workout + over budget", () => {
    const text = buildHomeSummarySentence({
      activeWorkout: true,
      caloriesEaten: 3447,
      calorieTarget: 2000,
    });
    expect(text).toBe("One workout is open and you're 1,447 kcal over today's budget.");
  });

  it("case 2: active workout + under budget", () => {
    const text = buildHomeSummarySentence({
      activeWorkout: true,
      caloriesEaten: 1580,
      calorieTarget: 2000,
    });
    expect(text).toBe("One workout is open and you have 420 kcal remaining.");
  });

  it("case 3: workout done + over budget", () => {
    const text = buildHomeSummarySentence({
      workoutDone: true,
      workoutTitle: "Push",
      caloriesEaten: 2320,
      calorieTarget: 2000,
    });
    expect(text).toBe("Push done. You're 320 kcal over today's budget.");
  });

  it("case 4: workout done + under budget", () => {
    const text = buildHomeSummarySentence({
      workoutDone: true,
      workoutTitle: "Push",
      caloriesEaten: 1160,
      calorieTarget: 2000,
    });
    expect(text).toBe("Push done. 840 kcal remaining today.");
  });

  it("case 5: rest day / no workout + over budget", () => {
    const text = buildHomeSummarySentence({
      isRestDay: true,
      caloriesEaten: 2210,
      calorieTarget: 2000,
    });
    expect(text).toBe("Rest day. You're 210 kcal over today's budget.");
  });

  it("case 6: rest day / no workout + under budget", () => {
    const text = buildHomeSummarySentence({
      isRestDay: true,
      caloriesEaten: 1048,
      calorieTarget: 2258,
    });
    expect(text).toBe("Rest day. 1,210 kcal remaining today.");
  });

  it("case 7: protein target missed late in day (>8pm, >25g remaining)", () => {
    const text = buildHomeSummarySentence({
      currentHour: 21,
      proteinRemaining: 28,
    });
    expect(text).toBe("28g protein remaining to hit your target.");
  });

  it("case 8: water low (>1.5L remaining late in day)", () => {
    const text = buildHomeSummarySentence({
      currentHour: 21,
      waterRemainingL: 1.8,
    });
    expect(text).toBe("1.8 L water remaining today.");
  });

  it("case 9: sleep logged", () => {
    const text = buildHomeSummarySentence({
      sleepHours: 7.5,
    });
    expect(text).toBe("7.5 hrs sleep logged last night.");
  });

  it("case 10: default fallback", () => {
    const text = buildHomeSummarySentence({});
    expect(text).toBe("All quiet today.");
  });
});
