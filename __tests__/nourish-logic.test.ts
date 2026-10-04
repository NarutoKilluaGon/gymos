import { estimateCardio, looksLikeCardio } from "@/services/nourish/cardio";
import {
  checkCountables,
  localFoodItems,
  reconcileEnergy,
} from "@/services/nourish/local-food";
import {
  cardioAllowance,
  confidenceLabel,
  dayBudget,
  isInconsistent,
  macroTargets,
  scaleNutrients,
  totalsFor,
} from "@/services/nourish/nutrition";
import {
  pickSlot,
  slotForTime,
  slotFromText,
  slotOfMeal,
} from "@/services/nourish/slots";
import type { Meal } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";

const draft = (over: Partial<DraftItem>): DraftItem => ({
  name: "Food",
  qty: "1 serving",
  calories: 100,
  protein: 5,
  carbs: 10,
  fat: 4,
  confidence: 0.8,
  multiplier: 1,
  source: "ai",
  ...over,
});

describe("meal slots", () => {
  it("derives a section from the time of day", () => {
    expect(slotForTime("08:00")).toBe("Breakfast");
    expect(slotForTime("11:29")).toBe("Breakfast");
    expect(slotForTime("11:30")).toBe("Lunch");
    expect(slotForTime("16:29")).toBe("Lunch");
    expect(slotForTime("16:30")).toBe("Snacks");
    expect(slotForTime("19:30")).toBe("Dinner");
  });

  it("counts after-midnight as the end of the evening", () => {
    expect(slotForTime("01:15")).toBe("Dinner");
    expect(slotForTime("04:00")).toBe("Breakfast");
  });

  it("reads a section the message names", () => {
    expect(slotFromText("2 eggs for breakfast")).toBe("Breakfast");
    expect(slotFromText("dinner: dal rice")).toBe("Dinner");
    expect(slotFromText("had lunch, a thali")).toBe("Lunch");
    expect(slotFromText("ate supper late")).toBe("Dinner");
  });

  it("ignores compound words and ambiguous messages", () => {
    expect(slotFromText("lunch box of rice")).toBeNull();
    expect(slotFromText("dinner plate with roti")).toBeNull();
    expect(slotFromText("breakfast eggs, dinner dal")).toBeNull();
    expect(slotFromText("2 rotis")).toBeNull();
  });

  it("picks named, then time, then first empty section", () => {
    const filled = new Set<"Breakfast" | "Lunch">(["Breakfast"]);

    expect(pickSlot({ named: "Dinner", at: "08:00", filled })).toBe("Dinner");
    expect(pickSlot({ named: null, at: "13:00", filled })).toBe("Lunch");
    expect(pickSlot({ named: null, at: null, filled })).toBe("Lunch");
    expect(
      pickSlot({
        named: null,
        at: null,
        filled: new Set(["Breakfast", "Lunch", "Snacks", "Dinner"]),
      }),
    ).toBe("Snacks");
  });

  it("uses the stored slot, else the timestamp", () => {
    const at = new Date(2026, 0, 5, 9, 0).toISOString();

    expect(slotOfMeal({ timestamp: at })).toBe("Breakfast");
    expect(slotOfMeal({ timestamp: at, slot: "Dinner" })).toBe("Dinner");
    expect(slotOfMeal({ timestamp: "garbage" })).toBe("Snacks");
  });
});

describe("day math", () => {
  const meal = (over: Partial<Meal>): Meal => ({
    id: "m",
    name: "x",
    timestamp: new Date().toISOString(),
    ...over,
  });

  it("totals nutrients and treats unknown as zero", () => {
    const totals = totalsFor([
      meal({ calories: 300, protein: 20, fiber: 4 }),
      meal({ calories: 200, carbs: 30 }),
    ]);

    expect(totals.calories).toBe(500);
    expect(totals.protein).toBe(20);
    expect(totals.carbs).toBe(30);
    expect(totals.fiber).toBe(4);
    expect(totals.sodium).toBe(0);
  });

  it("reports uncertainty from low-confidence entries only", () => {
    const sure = totalsFor([meal({ calories: 500, confidence: 1 })]);
    const rough = totalsFor([meal({ calories: 500, confidence: 0.5 })]);

    expect(sure.uncertainty).toBe(0);
    expect(rough.uncertainty).toBeCloseTo(100, 5);
  });

  it("adds back the chosen share of cardio", () => {
    expect(cardioAllowance(400, 0.5)).toBe(200);
    expect(cardioAllowance(400, 1)).toBe(400);
    expect(cardioAllowance(400, 0)).toBe(0);
    expect(dayBudget({ kcal: 2600, cardioReturn: 0.5 }, 400)).toBe(2800);
  });

  it("derives gram targets from the budget and split", () => {
    expect(macroTargets(2600, { protein: 140, split: "45,25" })).toEqual({
      protein: 140,
      carbs: 293,
      fat: 72,
    });
  });

  it("labels confidence", () => {
    expect(confidenceLabel(0.9).label).toBe("solid");
    expect(confidenceLabel(0.6).label).toBe("estimate");
    expect(confidenceLabel(0.3).label).toBe("rough guess");
  });

  it("scales known nutrients and leaves unknown ones absent", () => {
    const input: { calories: number; protein: number; fiber: number; iron?: number } = {
      calories: 100,
      protein: 5,
      fiber: 2,
    };
    const scaled = scaleNutrients(input, 1.5);

    expect(scaled.calories).toBe(150);
    expect(scaled.protein).toBe(7.5);
    expect(scaled.fiber).toBe(3);
    expect(scaled.iron).toBeUndefined();
  });

  it("flags calories that disagree with macros", () => {
    expect(isInconsistent({ calories: 100, protein: 5, carbs: 10, fat: 4 })).toBe(
      false,
    );
    expect(
      isInconsistent({ calories: 900, protein: 5, carbs: 10, fat: 4 }),
    ).toBe(true);
  });
});

describe("local food estimates", () => {
  it("estimates counts of staples", () => {
    const items = localFoodItems("2 rotis, dal");

    expect(items).toHaveLength(2);
    expect(items?.[0]?.calories).toBe(200);
    expect(items?.[0]?.protein).toBe(6);
    expect(items?.[1]?.calories).toBe(150);
    expect(items?.[0]?.source).toBe("local");
  });

  it("scales weight-based foods by 100 g", () => {
    const [paneer] = localFoodItems("200g paneer") ?? [];

    expect(paneer?.calories).toBe(600);
    expect(paneer?.protein).toBe(36);
  });

  it("handles number words and fractions", () => {
    const [egg] = localFoodItems("three eggs") ?? [];
    const [milk] = localFoodItems("half glass milk") ?? [];

    expect(egg?.calories).toBe(216);
    expect(milk?.calories).toBe(80);
  });

  it("returns null unless every part is recognised", () => {
    expect(localFoodItems("2 rotis, quinoa bowl")).toBeNull();
    expect(localFoodItems("")).toBeNull();
  });

  it("corrects a per-100g mix-up on a countable food", () => {
    const [fixed] = checkCountables([
      draft({ name: "Boiled egg", qty: "2 large", protein: 25, calories: 400 }),
    ]);

    expect(fixed?.protein).toBe(13);
    expect(fixed?.note).toBe("Adjusted to typical values");
    expect(fixed?.confidence).toBe(0.5);
  });

  it("leaves plausible and weight-based entries alone", () => {
    const ok = draft({ name: "Egg", qty: "2 eggs", protein: 12.6 });
    const weight = draft({ name: "Egg whites", qty: "200 g", protein: 40 });

    expect(checkCountables([ok])[0]).toEqual(ok);
    expect(checkCountables([weight])[0]).toEqual(weight);
  });

  it("recomputes calories from macros when they disagree", () => {
    const [fixed] = reconcileEnergy([
      draft({ calories: 900, protein: 5, carbs: 10, fat: 4 }),
    ]);

    expect(fixed?.calories).toBe(96);
    expect(fixed?.confidence).toBe(0.5);
  });
});

describe("cardio", () => {
  it("detects exercise text", () => {
    expect(looksLikeCardio("30 min walk")).toBe(true);
    expect(looksLikeCardio("climbed 20 floors")).toBe(true);
    expect(looksLikeCardio("2 rotis and dal")).toBe(false);
  });

  it("uses MET × kg × hours for a timed activity", () => {
    const e = estimateCardio("45 min cycling", 65);

    expect(e?.name).toBe("Cycle");
    expect(e?.minutes).toBe(45);
    expect(e?.kcal).toBe(366);
  });

  it("estimates from distance when no time is given", () => {
    const run = estimateCardio("5 km run", 70);

    expect(run?.name).toBe("Run");
    expect(run?.kcal).toBe(350);
  });

  it("estimates stair climbs including the descent", () => {
    const e = estimateCardio("19 floors x 10", 65);

    expect(e?.name).toBe("Stair climb");
    expect(e?.detail).toContain("570 m");
    expect(e?.kcal).toBe(451);
  });

  it("returns null when there is nothing to estimate from", () => {
    expect(estimateCardio("did some cardio", 65)).toBeNull();
  });
});

import { dayHeading, dayTitle } from "@/services/nourish/format";

describe("day labels", () => {
  it("names today, yesterday and other days", () => {
    expect(dayTitle("2026-03-15", "2026-03-15")).toBe("Today");
    expect(dayTitle("2026-03-14", "2026-03-15")).toBe("Yesterday");
    expect(dayTitle("2026-03-02", "2026-03-15")).toBe("Mon, 2 Mar");
    expect(dayHeading("2026-03-15")).toBe("Sunday, 15 Mar");
  });
});
