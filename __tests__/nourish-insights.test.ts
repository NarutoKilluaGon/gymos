import {
  availableRanges,
  bucketSeries,
  buildRecords,
  daysOnTarget,
  loggedSpanDays,
  mealByMeal,
  rangeDayCount,
  RANGES,
  recentDays,
} from "@/services/nourish/insights";
import {
  allowedByPrefs,
  suggestProteinOptions,
  type SuggestionCandidate,
} from "@/services/nourish/suggestions";
import {
  CHANGE_GUARD_DAYS,
  DEFAULT_SETTINGS,
  describeChanges,
  normalizeSettings,
  settingsFromLegacy,
  shouldGuardChange,
} from "@/services/nourish/targets";
import { buildWeeklyRead } from "@/services/nourish/weekly-read";
import {
  fromKg,
  suggestCalorieAdjustment,
  toKg,
  weeklySlope,
  weightPoints,
} from "@/services/nourish/weight";
import type { Meal, Measurement } from "@/types/gymos";
import { addDaysToKey, timestampForKey } from "@/utils/date";

const TODAY = "2026-03-15"; // a Sunday
const settings = { kcal: 2000, cardioReturn: 0.5 as const };

function meal(
  day: string,
  hm: string,
  over: Partial<Meal> = {},
): Meal {
  return {
    id: `${day}-${hm}-${Math.random()}`,
    name: "x",
    timestamp: timestampForKey(day, hm),
    calories: 500,
    protein: 20,
    ...over,
  };
}

describe("insights", () => {
  it("groups by local day and builds a window oldest-first", () => {
    const records = buildRecords(
      [meal(TODAY, "09:00"), meal(addDaysToKey(TODAY, -2), "13:00")],
      {},
      { [TODAY]: 400 },
    );
    const days = recentDays(7, TODAY, records, settings);

    expect(days).toHaveLength(7);
    expect(days[6]?.key).toBe(TODAY);
    expect(days[6]?.budget).toBe(2200);
    expect(days[6]?.totals?.calories).toBe(500);
    expect(days[5]?.totals).toBeNull();
    expect(days[4]?.totals?.calories).toBe(500);
  });

  it("measures the span and offers ranges only once history allows", () => {
    const records = buildRecords(
      [meal(addDaysToKey(TODAY, -9), "09:00")],
      {},
      {},
    );
    const span = loggedSpanDays(records, TODAY);

    expect(span).toBe(10);
    expect(availableRanges(span).map((r) => r.id)).toEqual(["7", "30"]);
    expect(availableRanges(0).map((r) => r.id)).toEqual(["7"]);
    expect(availableRanges(20).map((r) => r.id)).toEqual(["7", "30", "all"]);
    expect(rangeDayCount(RANGES[0]!, span)).toBe(7);
    expect(rangeDayCount(RANGES[4]!, span)).toBe(10);
  });

  it("buckets long ranges weekly and averages logged days only", () => {
    const records = buildRecords(
      [meal(TODAY, "09:00", { calories: 900 })],
      {},
      {},
    );
    const days = recentDays(60, TODAY, records, settings);
    const series = bucketSeries(days, "calories");

    expect(series.length).toBe(9);
    expect(series[series.length - 1]?.value).toBe(900);
    expect(series[0]?.value).toBe(0);
  });

  it("finds the lightest-protein meal and averages feel", () => {
    const meals = [
      meal(TODAY, "08:00", { protein: 30 }),
      meal(TODAY, "13:00", { protein: 10 }),
      meal(TODAY, "20:00", { protein: 25 }),
    ];
    const records = buildRecords(meals, { [TODAY]: { Lunch: 1 } }, {});
    const days = recentDays(1, TODAY, records, settings);
    const { rows, weakest } = mealByMeal(days);

    expect(weakest?.slot).toBe("Snacks");
    expect(rows.find((r) => r.slot === "Lunch")?.feel).toBe(1);
    expect(rows.find((r) => r.slot === "Breakfast")?.protein).toBe(30);
  });

  it("counts days within 10% of budget", () => {
    const records = buildRecords(
      [meal(TODAY, "09:00", { calories: 2050 })],
      {},
      {},
    );

    expect(daysOnTarget(recentDays(1, TODAY, records, settings))).toBe(1);
  });
});

describe("weight", () => {
  const m = (day: string, value: number, unit: "kg" | "lb" = "kg", hm = "07:00"): Measurement =>
    ({
      id: `${day}${hm}`,
      type: "weight",
      value,
      unit,
      timestamp: timestampForKey(day, hm),
    }) as Measurement;

  it("keeps one kg point per day, last reading wins", () => {
    const points = weightPoints([
      m("2026-03-01", 80),
      m("2026-03-01", 79, "kg", "20:00"),
      m("2026-03-02", 176.37, "lb"),
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]?.kg).toBe(79);
    expect(points[1]?.kg).toBeCloseTo(80, 1);
  });

  it("converts units both ways", () => {
    expect(toKg(220, "lb")).toBeCloseTo(99.79, 1);
    expect(fromKg(100, "lb")).toBeCloseTo(220.46, 1);
  });

  it("needs a week of data for a trend", () => {
    expect(
      weeklySlope(weightPoints([m("2026-03-01", 80), m("2026-03-05", 79)])),
    ).toBeNull();
    expect(
      weeklySlope(weightPoints([m("2026-03-01", 80), m("2026-03-15", 79)])),
    ).toBeCloseTo(-0.5, 5);
  });

  it("suggests calories in 50 kcal steps with a dead band", () => {
    expect(suggestCalorieAdjustment(0.25, 0.2)).toBe(0);
    expect(suggestCalorieAdjustment(0.25, -0.25)).toBe(550);
    expect(suggestCalorieAdjustment(-0.5, 0)).toBe(-550);
  });
});

describe("targets", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  it("normalizes junk to defaults", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({ kcal: -5, protein: "x", split: "9,9" }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ kcal: 2200 }).kcal).toBe(2200);
  });

  it("seeds from legacy targets without losing them", () => {
    expect(settingsFromLegacy({ calories: 2300, protein: 150 }, null)).toMatchObject({
      kcal: 2300,
      protein: 150,
    });
    expect(
      settingsFromLegacy(
        { maintenanceCalories: 2500, calorieGoal: "deficit", goalAdjustmentKcal: 400 },
        { weightKg: 72 },
      ),
    ).toMatchObject({ kcal: 2100, weeklyRate: -0.5, fallbackWeightKg: 72 });
    expect(settingsFromLegacy(null, null).kcal).toBe(DEFAULT_SETTINGS.kcal);
  });

  it("lists what changed", () => {
    expect(
      describeChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, kcal: 2500, split: "40,30" }),
    ).toEqual(["Calories 2600 → 2500", "Split 45,25 → 40,30"]);
  });

  it("guards a second change inside two weeks", () => {
    const log = (daysAgo: number) => [
      { date: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), change: "x" },
    ];

    expect(shouldGuardChange([], now)).toBe(false);
    expect(shouldGuardChange(log(3), now)).toBe(true);
    expect(shouldGuardChange(log(CHANGE_GUARD_DAYS), now)).toBe(false);
  });
});

describe("suggestions", () => {
  const cand = (name: string, calories: number, protein: number, origin: "saved" | "catalog" = "catalog"): SuggestionCandidate => ({
    name, qty: "1", calories, protein, carbs: 5, fat: 5, origin,
  });

  it("filters by dietary notes", () => {
    expect(allowedByPrefs("Chicken breast", "vegetarian")).toBe(false);
    expect(allowedByPrefs("Boiled egg", "vegetarian")).toBe(false);
    expect(allowedByPrefs("Boiled egg", "vegetarian, eggetarian")).toBe(true);
    expect(allowedByPrefs("Paneer", "vegan")).toBe(false);
    expect(allowedByPrefs("Mushroom curry", "no mushrooms")).toBe(false);
    expect(allowedByPrefs("Mushroom curry", "no mushroom")).toBe(false);
    expect(allowedByPrefs("Dal", "")).toBe(true);
  });

  it("ranks by protein per calorie, respects limits and dedupes", () => {
    const out = suggestProteinOptions({
      gapGrams: 40,
      kcalLeft: 400,
      prefs: "",
      candidates: [
        cand("Whey", 120, 24),
        cand("Whey", 120, 24),
        cand("Chicken", 165, 31),
        cand("Rice", 200, 4),
        cand("Big meal", 900, 60),
        cand("Dal", 300, 18),
      ],
    });

    expect(out.map((s) => s.name)).toEqual(["Whey", "Chicken", "Dal"]);
    expect(out[0]?.why).toContain("24g protein");
  });

  it("only offers lean options once calories are spent", () => {
    const out = suggestProteinOptions({
      gapGrams: 30,
      kcalLeft: -100,
      prefs: "",
      candidates: [cand("Whey", 120, 24), cand("Paneer", 300, 18)],
    });

    expect(out.map((s) => s.name)).toEqual(["Whey"]);
  });

  it("prefers a user's usual food on a near tie", () => {
    const out = suggestProteinOptions({
      gapGrams: 30,
      kcalLeft: 500,
      prefs: "",
      limit: 1,
      candidates: [cand("Catalog curd", 100, 10), cand("My curd", 100, 9.2, "saved")],
    });

    expect(out[0]?.name).toBe("My curd");
  });
});

describe("weekly read", () => {
  const build = (meals: Meal[], extra: Partial<Parameters<typeof buildWeeklyRead>[0]> = {}) => {
    const records = buildRecords(meals, {}, {});

    return buildWeeklyRead({
      days: recentDays(14, TODAY, records, settings),
      settings: { kcal: 2000, protein: 120, weeklyRate: 0 },
      weightSlope: null,
      ...extra,
    });
  };

  it("refuses to invent patterns from too little data", () => {
    const read = build([meal(TODAY, "09:00")]);

    expect(read.actions).toEqual([]);
    expect(read.summary).toContain("too little");
    expect(read.basedOnDays).toBe(1);
  });

  it("names the protein gap and the weakest meal", () => {
    const meals = [0, 1, 2, 3].flatMap((back) => {
      const day = addDaysToKey(TODAY, -back);

      return [
        meal(day, "08:00", { protein: 30 }),
        meal(day, "13:00", { protein: 30 }),
        meal(day, "17:00", { protein: 5 }),
        meal(day, "20:00", { protein: 30 }),
      ];
    });
    const read = build(meals);

    expect(read.actions[0]?.do).toContain("Snacks");
    expect(read.actions[0]?.why).toContain("95g");
    expect(read.actions[0]?.why).toContain("120g target");
  });

  it("reports on-target protein as a note, not an action", () => {
    const meals = [0, 1, 2].map((back) =>
      meal(addDaysToKey(TODAY, -back), "13:00", { protein: 130 }),
    );
    const read = build(meals);

    expect(read.actions.some((a) => a.do.includes("protein"))).toBe(false);
    expect(read.summary).toContain("Protein is on target");
  });

  it("surfaces a weight-trend calorie change first", () => {
    const meals = [0, 1, 2].map((back) =>
      meal(addDaysToKey(TODAY, -back), "13:00", { protein: 130 }),
    );
    const read = build(meals, { weightSlope: 0.6 });

    expect(read.actions[0]?.do).toBe("Change your calorie target by -650 kcal a day");
  });
});

import { buildDayModel, burnByDay, workoutCardioByDay } from "@/services/nourish/day-model";

describe("day model", () => {
  const timeline = [
    { kind: "cardio", id: "w1", timestamp: timestampForKey(TODAY, "07:00"), activity: "running", durationMin: 30, calories: 300 },
    { kind: "cardio", id: "w2", timestamp: timestampForKey(TODAY, "18:00"), activity: "walk", durationMin: 20 },
    { kind: "journal", id: "j", timestamp: timestampForKey(TODAY, "09:00"), text: "x" },
  ] as never;

  it("reads Workouts cardio, estimating when calories weren't entered", () => {
    const byDay = workoutCardioByDay(timeline);

    expect(byDay[TODAY]).toHaveLength(2);
    expect(byDay[TODAY]?.[0]).toMatchObject({ name: "Running", kcal: 300, detail: "30 min" });
    expect(byDay[TODAY]?.[1]).toMatchObject({ kcal: 160, detail: "20 min · estimated", removable: false });
  });

  it("builds budget, sections and gaps for a day", () => {
    const workouts = workoutCardioByDay(timeline);
    const cardio = { [TODAY]: [{ id: "c", name: "Walk", detail: "x", minutes: 10, kcal: 40, loggedAt: "" }] };
    const model = buildDayModel({
      key: TODAY,
      meals: [meal(TODAY, "09:00", { calories: 600, protein: 40 }), meal(TODAY, "20:00", { calories: 800, protein: 30, slot: "Snacks" })],
      feel: { [TODAY]: { Breakfast: 3 } },
      cardio,
      workoutCardio: workouts,
      settings: { ...DEFAULT_SETTINGS, kcal: 2000, protein: 100 },
    });

    expect(model.burnKcal).toBe(500);
    expect(model.budget).toBe(2250);
    expect(model.remaining).toBe(850);
    expect(model.proteinGap).toBe(30);
    expect(model.bySlot.Breakfast).toHaveLength(1);
    expect(model.bySlot.Snacks).toHaveLength(1);
    expect(model.bySlot.Dinner).toHaveLength(0);
    expect(model.feel.Breakfast).toBe(3);
    expect(model.burn.map((b) => b.source)).toEqual(["nourish", "workouts", "workouts"]);
    expect(burnByDay(cardio, workouts)[TODAY]).toBe(500);
  });
});

describe("malformed data never poisons the budget", () => {
  it("skips Workouts cardio whose numbers are unusable", () => {
    const bad = [
      { kind: "cardio", id: "x", timestamp: timestampForKey(TODAY, "07:00"), activity: "run", durationMin: "x" },
      { kind: "cardio", id: "y", timestamp: timestampForKey(TODAY, "08:00"), activity: "run", durationMin: 10, calories: Number.NaN },
    ] as never;
    const byDay = workoutCardioByDay(bad);

    expect(byDay[TODAY]).toHaveLength(1);
    expect(byDay[TODAY]?.[0]?.kcal).toBe(80);

    const model = buildDayModel({ key: TODAY, meals: [], feel: {}, cardio: {}, workoutCardio: byDay, settings: DEFAULT_SETTINGS });

    expect(Number.isFinite(model.budget)).toBe(true);
    expect(Number.isFinite(model.remaining)).toBe(true);
  });
});
