import { N } from "@/constants/nourish-theme";

export type MacroItemViewModel = {
  name: "Protein" | "Carbs" | "Fat";
  color: string;
  eaten: number;
  target: number;
  isOver: boolean;
  displayRemaining: string;
  barProgress: number;
};

export type SummaryCardViewModel = {
  calories: {
    remaining: number;
    isOver: boolean;
    displayNumber: string;
    displayLabel: string;
    ringProgress: number;
    ringColor: string;
    fontSize: number;
  };
  macros: [MacroItemViewModel, MacroItemViewModel, MacroItemViewModel];
  footer: {
    eaten: number;
    budget: number;
    burned: number;
    uncertainty?: number;
    line: string;
  };
  isEmpty: boolean;
};

export function fmtInt(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function computeSummaryCardViewModel(input: {
  eatenKcal: number;
  budgetKcal: number;
  burnedKcal: number;
  uncertainty?: number;
  macrosEaten: { protein: number; carbs: number; fat: number };
  macroTargets: { protein: number; carbs: number; fat: number };
}): SummaryCardViewModel {
  const {
    eatenKcal,
    budgetKcal,
    burnedKcal,
    uncertainty,
    macrosEaten,
    macroTargets,
  } = input;

  const diffKcal = budgetKcal - eatenKcal;
  const isKcalOver = eatenKcal > budgetKcal;
  const remainingKcal = Math.abs(diffKcal);

  const displayNumber = isKcalOver
    ? `+${fmtInt(remainingKcal)}`
    : fmtInt(remainingKcal);
  const displayLabel = isKcalOver ? "kcal over" : "kcal left";

  // Clamp font size so 5 digits fit inside 96dp ring
  const numDigits = displayNumber.replace(/[^\d]/g, "").length;
  let fontSize = 22;
  if (numDigits >= 5 || displayNumber.length >= 7) {
    fontSize = 17;
  } else if (numDigits === 4 || displayNumber.length >= 5) {
    fontSize = 19;
  }

  const rawKcalRatio = budgetKcal > 0 ? eatenKcal / budgetKcal : 0;
  const ringProgress = isKcalOver
    ? 1
    : Number.isFinite(rawKcalRatio)
      ? Math.min(1, Math.max(0, rawKcalRatio))
      : 0;
  const ringColor = isKcalOver ? N.bad : N.acc;

  const createMacroRow = (
    name: "Protein" | "Carbs" | "Fat",
    color: string,
    eaten: number,
    target: number,
  ): MacroItemViewModel => {
    const isOver = eaten > target;
    const diff = target - eaten;
    const absDiff = Math.abs(diff);

    const displayRemaining = isOver
      ? `+${Math.round(absDiff)}g over`
      : `${Math.round(absDiff)}g left`;

    const rawRatio = target > 0 ? eaten / target : 0;
    const barProgress = Number.isFinite(rawRatio)
      ? Math.min(1, Math.max(0, rawRatio))
      : 0;

    return {
      name,
      color,
      eaten,
      target,
      isOver,
      displayRemaining,
      barProgress,
    };
  };

  const macros: [MacroItemViewModel, MacroItemViewModel, MacroItemViewModel] = [
    createMacroRow("Protein", N.protein, macrosEaten.protein, macroTargets.protein),
    createMacroRow("Carbs", N.carbs, macrosEaten.carbs, macroTargets.carbs),
    createMacroRow("Fat", N.fat, macrosEaten.fat, macroTargets.fat),
  ];

  const eatenFormatted =
    uncertainty && uncertainty > 0
      ? `Eaten ${fmtInt(eatenKcal)} (±${fmtInt(uncertainty)})`
      : `Eaten ${fmtInt(eatenKcal)}`;
  const budgetFormatted = `Budget ${fmtInt(budgetKcal)}`;
  const burnedFormatted = `Burned ${fmtInt(burnedKcal)}`;
  const line = `${eatenFormatted} · ${budgetFormatted} · ${burnedFormatted}`;

  const isEmpty =
    eatenKcal === 0 &&
    macrosEaten.protein === 0 &&
    macrosEaten.carbs === 0 &&
    macrosEaten.fat === 0;

  return {
    calories: {
      remaining: remainingKcal,
      isOver: isKcalOver,
      displayNumber,
      displayLabel,
      ringProgress,
      ringColor,
      fontSize,
    },
    macros,
    footer: {
      eaten: eatenKcal,
      budget: budgetKcal,
      burned: burnedKcal,
      uncertainty,
      line,
    },
    isEmpty,
  };
}
