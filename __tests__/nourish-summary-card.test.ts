import {
  computeSummaryCardViewModel,
  fmtInt,
} from "@/components/nutrition/summary-card-view-model";
import { N } from "@/constants/nourish-theme";

describe("SummaryCard ViewModel (Step 5)", () => {
  const defaultTargets = {
    protein: 150,
    carbs: 200,
    fat: 67,
  };

  it("handles empty state (0 eaten): ring track only, macros show 'Ng left', no placeholder dashes", () => {
    const vm = computeSummaryCardViewModel({
      eatenKcal: 0,
      budgetKcal: 2000,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });

    expect(vm.isEmpty).toBe(true);

    // Calories: budget remaining, ring progress 0 (track only)
    expect(vm.calories.isOver).toBe(false);
    expect(vm.calories.remaining).toBe(2000);
    expect(vm.calories.displayNumber).toBe("2,000");
    expect(vm.calories.displayLabel).toBe("kcal left");
    expect(vm.calories.ringProgress).toBe(0);
    expect(vm.calories.ringColor).toBe(N.acc);

    // Macros: "Ng left", no placeholder dashes
    const [p, c, f] = vm.macros;
    expect(p.name).toBe("Protein");
    expect(p.displayRemaining).toBe("150g left");
    expect(p.isOver).toBe(false);
    expect(p.barProgress).toBe(0);

    expect(c.name).toBe("Carbs");
    expect(c.displayRemaining).toBe("200g left");
    expect(c.isOver).toBe(false);
    expect(c.barProgress).toBe(0);

    expect(f.name).toBe("Fat");
    expect(f.displayRemaining).toBe("67g left");
    expect(f.isOver).toBe(false);
    expect(f.barProgress).toBe(0);

    // Footer
    expect(vm.footer.line).toBe("Eaten 0 · Budget 2,000 · Burned 0");
  });

  it("handles under state: remaining kcal in large serif + kcal left, partial ring, macros left, footer with uncertainty", () => {
    const vm = computeSummaryCardViewModel({
      eatenKcal: 1450,
      budgetKcal: 2000,
      burnedKcal: 280,
      uncertainty: 55,
      macrosEaten: { protein: 110, carbs: 140, fat: 50 },
      macroTargets: defaultTargets,
    });

    expect(vm.isEmpty).toBe(false);

    // Calories: 550 kcal left
    expect(vm.calories.isOver).toBe(false);
    expect(vm.calories.remaining).toBe(550);
    expect(vm.calories.displayNumber).toBe("550");
    expect(vm.calories.displayLabel).toBe("kcal left");
    expect(vm.calories.ringProgress).toBeCloseTo(1450 / 2000);
    expect(vm.calories.ringColor).toBe(N.acc);

    // Macros
    const [p, c, f] = vm.macros;
    expect(p.displayRemaining).toBe("40g left");
    expect(p.isOver).toBe(false);
    expect(p.barProgress).toBeCloseTo(110 / 150);

    expect(c.displayRemaining).toBe("60g left");
    expect(c.isOver).toBe(false);
    expect(c.barProgress).toBeCloseTo(140 / 200);

    expect(f.displayRemaining).toBe("17g left");
    expect(f.isOver).toBe(false);
    expect(f.barProgress).toBeCloseTo(50 / 67);

    // Footer with uncertainty
    expect(vm.footer.line).toBe("Eaten 1,450 (±55) · Budget 2,000 · Burned 280");
  });

  it("handles exact state: 0 kcal left, 100% ring filled, 0g left for exact macros", () => {
    const vm = computeSummaryCardViewModel({
      eatenKcal: 2000,
      budgetKcal: 2000,
      burnedKcal: 150,
      macrosEaten: { protein: 150, carbs: 200, fat: 67 },
      macroTargets: defaultTargets,
    });

    expect(vm.isEmpty).toBe(false);

    // Calories: exactly 0 remaining, not over
    expect(vm.calories.isOver).toBe(false);
    expect(vm.calories.remaining).toBe(0);
    expect(vm.calories.displayNumber).toBe("0");
    expect(vm.calories.displayLabel).toBe("kcal left");
    expect(vm.calories.ringProgress).toBe(1);
    expect(vm.calories.ringColor).toBe(N.acc);

    // Macros: 0g left, barProgress 1.0
    const [p, c, f] = vm.macros;
    expect(p.displayRemaining).toBe("0g left");
    expect(p.barProgress).toBe(1);
    expect(c.displayRemaining).toBe("0g left");
    expect(c.barProgress).toBe(1);
    expect(f.displayRemaining).toBe("0g left");
    expect(f.barProgress).toBe(1);

    expect(vm.footer.line).toBe("Eaten 2,000 · Budget 2,000 · Burned 150");
  });

  it("handles over state: +N kcal over in N.bad, ring fully filled in N.bad, +Ng over in N.bad, clamped 100% bar", () => {
    const vm = computeSummaryCardViewModel({
      eatenKcal: 2420,
      budgetKcal: 2000,
      burnedKcal: 400,
      macrosEaten: { protein: 175, carbs: 230, fat: 80 },
      macroTargets: defaultTargets,
    });

    expect(vm.isEmpty).toBe(false);

    // Calories: +420 kcal over, ringColor N.bad, ringProgress 1.0
    expect(vm.calories.isOver).toBe(true);
    expect(vm.calories.remaining).toBe(420);
    expect(vm.calories.displayNumber).toBe("+420");
    expect(vm.calories.displayLabel).toBe("kcal over");
    expect(vm.calories.ringProgress).toBe(1);
    expect(vm.calories.ringColor).toBe(N.bad);

    // Macros: all over, bars clamped at 1.0
    const [p, c, f] = vm.macros;
    expect(p.isOver).toBe(true);
    expect(p.displayRemaining).toBe("+25g over");
    expect(p.barProgress).toBe(1);

    expect(c.isOver).toBe(true);
    expect(c.displayRemaining).toBe("+30g over");
    expect(c.barProgress).toBe(1);

    expect(f.isOver).toBe(true);
    expect(f.displayRemaining).toBe("+13g over");
    expect(f.barProgress).toBe(1);

    expect(vm.footer.line).toBe("Eaten 2,420 · Budget 2,000 · Burned 400");
  });

  it("clamps font size so 5 digits fit inside 96dp ring", () => {
    // 3 digits
    const vm3 = computeSummaryCardViewModel({
      eatenKcal: 500,
      budgetKcal: 1000,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vm3.calories.fontSize).toBe(22);

    // 4 digits (e.g. 1,500)
    const vm4 = computeSummaryCardViewModel({
      eatenKcal: 500,
      budgetKcal: 2000,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vm4.calories.fontSize).toBe(19);

    // 5 digits (e.g. 10,000)
    const vm5 = computeSummaryCardViewModel({
      eatenKcal: 0,
      budgetKcal: 10000,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vm5.calories.fontSize).toBe(17);

    // Over with 5 digits (e.g. +12,500)
    const vmOver5 = computeSummaryCardViewModel({
      eatenKcal: 14500,
      budgetKcal: 2000,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vmOver5.calories.fontSize).toBe(17);
  });

  it("formats displayNumber correctly for over (+1,210), under (1,210), and zero (0) without double signs", () => {
    const vmOver = computeSummaryCardViewModel({
      eatenKcal: 3468,
      budgetKcal: 2258,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vmOver.calories.isOver).toBe(true);
    expect(vmOver.calories.displayNumber).toBe("+1,210");
    expect(vmOver.calories.displayNumber.startsWith("++")).toBe(false);

    const vmUnder = computeSummaryCardViewModel({
      eatenKcal: 1048,
      budgetKcal: 2258,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vmUnder.calories.isOver).toBe(false);
    expect(vmUnder.calories.displayNumber).toBe("1,210");
    expect(vmUnder.calories.displayNumber.startsWith("+")).toBe(false);

    const vmZero = computeSummaryCardViewModel({
      eatenKcal: 2258,
      budgetKcal: 2258,
      burnedKcal: 0,
      macrosEaten: { protein: 0, carbs: 0, fat: 0 },
      macroTargets: defaultTargets,
    });
    expect(vmZero.calories.isOver).toBe(false);
    expect(vmZero.calories.displayNumber).toBe("0");
  });
});
