import {
  DEFAULT_GOAL_ADJUSTMENT_KCAL,
  ESTIMATED_CARDIO_KCAL_PER_MIN,
  ESTIMATED_WORKOUT_KCAL_PER_MIN,
  calculateCalorieTarget,
  estimateActivityExpenditure,
} from "@/services/calorie-target";

/** Fixed "today" so timestamps stay deterministic in any timezone. */
const TODAY = "2026-09-24";
const at = (time: string): string => `${TODAY}T${time}:00`;

function workout(durationMin: number, timestamp = at("08:00")): unknown {
  return {
    kind: "workout",
    id: "e-w1",
    timestamp,
    name: "Push day",
    durationMs: durationMin * 60000,
    exerciseCount: 3,
  };
}

function cardio(
  input: { durationMin: number; calories?: number },
  timestamp = at("18:00"),
): unknown {
  return {
    kind: "cardio",
    id: "e-c1",
    timestamp,
    activity: "running",
    durationMin: input.durationMin,
    ...(input.calories !== undefined
      ? { calories: input.calories }
      : {}),
  };
}

describe("S7: calorie-target engine", () => {
  it("(a) maintenance goal targets the estimated maintenance", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(result).toMatchObject({
      hasMaintenance: true,
      baseMaintenance: 2200,
      activityKcal: 0,
      estimatedMaintenance: 2200,
      goal: "maintain",
      adjustmentKcal: 0,
      targetKcal: 2200,
    });
  });

  it("(b) deficit goal lowers the target", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "deficit",
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(result.adjustmentKcal).toBe(
      -DEFAULT_GOAL_ADJUSTMENT_KCAL,
    );
    expect(result.targetKcal).toBe(
      2200 - DEFAULT_GOAL_ADJUSTMENT_KCAL,
    );
  });

  it("(b) deficit honors a configured adjustment magnitude", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "deficit",
      goalAdjustmentKcal: 300,
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(result.adjustmentKcal).toBe(-300);
    expect(result.targetKcal).toBe(1900);
  });

  it("(c) surplus goal raises the target", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "surplus",
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(result.adjustmentKcal).toBe(
      DEFAULT_GOAL_ADJUSTMENT_KCAL,
    );
    expect(result.targetKcal).toBe(
      2200 + DEFAULT_GOAL_ADJUSTMENT_KCAL,
    );
  });

  it("(c) surplus honors a configured adjustment magnitude", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "surplus",
      goalAdjustmentKcal: 250,
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(result.adjustmentKcal).toBe(250);
    expect(result.targetKcal).toBe(2450);
  });

  it("(d) logged workout expenditure raises estimated maintenance", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [workout(30)],
      todayKey: TODAY,
    });

    // 30 min at the documented placeholder rate.
    expect(result.workoutKcal).toBe(
      30 * ESTIMATED_WORKOUT_KCAL_PER_MIN,
    );
    expect(result.workoutKcal).toBe(180);
    expect(result.activityKcal).toBe(180);
    expect(result.estimatedMaintenance).toBe(2380);
    expect(result.targetKcal).toBe(2380);
  });

  it("(e) stored cardio calories are used as logged", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [cardio({ durationMin: 30, calories: 250 })],
      todayKey: TODAY,
    });

    // The user's own logged value wins over the duration fallback
    // (30 min × 8 would be 240, not 250).
    expect(result.cardioKcal).toBe(250);
    expect(result.estimatedMaintenance).toBe(2450);
    expect(result.targetKcal).toBe(2450);
  });

  it("(e) cardio without logged calories falls back to a duration estimate", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [cardio({ durationMin: 20 })],
      todayKey: TODAY,
    });

    expect(result.cardioKcal).toBe(
      20 * ESTIMATED_CARDIO_KCAL_PER_MIN,
    );
    expect(result.cardioKcal).toBe(160);
  });

  it("(f) workout and cardio combine into one activity total", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "deficit",
      timelineItems: [
        workout(30),
        cardio({ durationMin: 30, calories: 250 }),
      ],
      todayKey: TODAY,
    });

    expect(result.workoutKcal).toBe(180);
    expect(result.cardioKcal).toBe(250);
    expect(result.activityKcal).toBe(430);
    expect(result.estimatedMaintenance).toBe(2630);
    expect(result.targetKcal).toBe(2630 - 500);
  });

  it("(g) no activity leaves base maintenance as the estimate", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [],
      todayKey: TODAY,
    });

    expect(estimateActivityExpenditure([])).toEqual({
      workoutKcal: 0,
      cardioKcal: 0,
      totalKcal: 0,
      workoutCount: 0,
      cardioCount: 0,
    });
    expect(result.activityKcal).toBe(0);
    expect(result.estimatedMaintenance).toBe(
      result.baseMaintenance,
    );
  });

  it("(h) steps cannot change the target", () => {
    const base = {
      maintenanceCalories: 2200,
      goal: "maintain" as const,
      todayKey: TODAY,
    };

    // Steps live outside the engine: whatever the step count, the same
    // configuration + activity yields the same target.
    const withoutSteps = calculateCalorieTarget({
      ...base,
      timelineItems: [workout(30)],
    });
    const withStepsNearby = calculateCalorieTarget({
      ...base,
      timelineItems: [workout(30)],
    });
    expect(withStepsNearby).toEqual(withoutSteps);

    // Even a steps-shaped object inside the activity list is ignored,
    // as are meal summaries and other non-training kinds.
    const polluted = calculateCalorieTarget({
      ...base,
      timelineItems: [
        workout(30),
        { kind: "steps", count: 15000, timestamp: at("12:00") },
        {
          kind: "meal",
          id: "e-m1",
          timestamp: at("12:00"),
          name: "Lunch",
          calories: 600,
        },
        { kind: "water", id: "e-w", timestamp: at("13:00") },
      ],
    });
    expect(polluted.activityKcal).toBe(180);
    expect(polluted.targetKcal).toBe(2380);

    // The result shape carries no steps field for anything to read.
    expect(Object.keys(polluted).sort()).toEqual(
      [
        "activityKcal",
        "adjustmentKcal",
        "baseMaintenance",
        "cardioKcal",
        "estimatedMaintenance",
        "goal",
        "hasMaintenance",
        "targetKcal",
        "workoutKcal",
      ].sort(),
    );
  });

  it("(i) malformed or missing activity data degrades to zero, never throws", () => {
    const result = calculateCalorieTarget({
      maintenanceCalories: 2200,
      goal: "maintain",
      timelineItems: [
        null,
        undefined,
        42,
        "workout",
        {},
        { kind: "workout" }, // no duration
        { kind: "workout", durationMs: -5 },
        { kind: "workout", durationMs: Number.NaN },
        { kind: "cardio", durationMin: 0 },
        { kind: "cardio", calories: "lots" },
        { kind: "cardio", calories: -50 },
        // Valid shape, wrong day: not today's expenditure.
        workout(60, "2026-09-23T08:00:00"),
        // Valid shape, unusable timestamp: cannot place on today.
        { kind: "cardio", id: "c-bad", timestamp: "not-a-date" },
      ],
      todayKey: TODAY,
    });

    expect(result.activityKcal).toBe(0);
    expect(result.workoutKcal).toBe(0);
    expect(result.cardioKcal).toBe(0);
    expect(result.estimatedMaintenance).toBe(2200);
    expect(result.targetKcal).toBe(2200);

    expect(
      estimateActivityExpenditure(null).totalKcal,
    ).toBe(0);
    expect(
      estimateActivityExpenditure(undefined).totalKcal,
    ).toBe(0);
  });

  it("(j) invalid values can never produce NaN or Infinity", () => {
    const cases: Array<Parameters<typeof calculateCalorieTarget>[0]> = [
      {},
      { maintenanceCalories: -100 },
      { maintenanceCalories: Number.NaN },
      { maintenanceCalories: Number.POSITIVE_INFINITY },
      { maintenanceCalories: "2200" },
      {
        maintenanceCalories: 2200,
        goal: "bulk",
        goalAdjustmentKcal: Number.NaN,
      },
      {
        maintenanceCalories: 2200,
        timelineItems: [
          { kind: "workout", durationMs: Number.POSITIVE_INFINITY },
          { kind: "cardio", durationMin: Number.POSITIVE_INFINITY },
        ],
        todayKey: TODAY,
      },
    ];

    for (const input of cases) {
      const result = calculateCalorieTarget({
        ...input,
        todayKey: TODAY,
      });

      for (const value of Object.values(result)) {
        if (typeof value === "number") {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
      expect(result.targetKcal).toBeGreaterThanOrEqual(0);
    }

    // Unknown goals resolve to maintenance (no adjustment either way).
    expect(
      calculateCalorieTarget({
        maintenanceCalories: 2200,
        goal: "bulk",
        timelineItems: [],
        todayKey: TODAY,
      }).adjustmentKcal,
    ).toBe(0);
  });

  it("(k) consumed meal calories stay independent of the target", () => {
    // Meals are not an engine input: eating 500 or 1800 kcal changes
    // nothing about today's target — the summary pairs them separately.
    const engineInput = {
      maintenanceCalories: 2200,
      goal: "deficit" as const,
      timelineItems: [workout(30)],
      todayKey: TODAY,
    };

    const afterLightDay = calculateCalorieTarget(engineInput);
    const afterHeavyDay = calculateCalorieTarget(engineInput);

    expect(afterHeavyDay).toEqual(afterLightDay);
    expect(afterHeavyDay.targetKcal).toBe(2380 - 500);
  });
});
