import {
  NUTRIENT_KEYS,
  type Meal,
  type Micronutrients,
} from "@/types/gymos";
import type { NourishSettings, SplitKey } from "@/types/nourish";

/** Confidence assumed for records saved before confidence existed. */
export const DEFAULT_CONFIDENCE = 0.7;

/** Share of the gap between stated and true calories we expect to be off
 *  for an uncertain entry; drives the "±N" shown beside calories eaten. */
const UNCERTAINTY_FACTOR = 0.4;

export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  calcium: number;
  iron: number;
  /** Plausible ± calories from low-confidence entries. */
  uncertainty: number;
};

export function confidenceOf(meal: Pick<Meal, "confidence">): number {
  return typeof meal.confidence === "number" &&
    Number.isFinite(meal.confidence)
    ? meal.confidence
    : DEFAULT_CONFIDENCE;
}

function amount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function totalsFor(meals: readonly Meal[]): DayTotals {
  const totals: DayTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    calcium: 0,
    iron: 0,
    uncertainty: 0,
  };

  for (const meal of meals) {
    totals.calories += amount(meal.calories);
    totals.protein += amount(meal.protein);
    totals.carbs += amount(meal.carbs);
    totals.fat += amount(meal.fat);
    totals.fiber += amount(meal.fiber);
    totals.sodium += amount(meal.sodium);
    totals.calcium += amount(meal.calcium);
    totals.iron += amount(meal.iron);
    totals.uncertainty +=
      amount(meal.calories) *
      (1 - confidenceOf(meal)) *
      UNCERTAINTY_FACTOR;
  }

  return totals;
}

export type ConfidenceLabel = {
  color: string;
  label: "solid" | "estimate" | "rough guess";
};

export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.8) return { color: "#4c9a6a", label: "solid" };
  if (confidence >= 0.5) return { color: "#d9a441", label: "estimate" };

  return { color: "#c8634b", label: "rough guess" };
}

export function parseSplit(split: SplitKey): {
  carbPct: number;
  fatPct: number;
} {
  const [carbPct, fatPct] = split.split(",").map(Number);

  return { carbPct: carbPct ?? 45, fatPct: fatPct ?? 25 };
}

/** Calories added back to today's budget for logged cardio. */
export function cardioAllowance(
  burnedKcal: number,
  cardioReturn: NourishSettings["cardioReturn"],
): number {
  return Math.round(burnedKcal * cardioReturn);
}

export function dayBudget(
  settings: Pick<NourishSettings, "kcal" | "cardioReturn">,
  burnedKcal: number,
): number {
  return settings.kcal + cardioAllowance(burnedKcal, settings.cardioReturn);
}

/** Gram targets for the day: protein is fixed, carbs and fat take their
 *  calorie share of the (cardio-adjusted) budget. */
export function macroTargets(
  budget: number,
  settings: Pick<NourishSettings, "protein" | "split">,
): { protein: number; carbs: number; fat: number } {
  const { carbPct, fatPct } = parseSplit(settings.split);

  return {
    protein: settings.protein,
    carbs: Math.round((budget * carbPct) / 400),
    fat: Math.round((budget * fatPct) / 900),
  };
}

export type MicroSpec = {
  key: "fiber" | "sodium" | "calcium" | "iron";
  label: string;
  target: number;
  unit: "g" | "mg";
  /** A limit is something to stay under; a goal is something to reach. */
  kind: "goal" | "limit";
};

export const MICRO_SPECS: readonly MicroSpec[] = [
  { key: "fiber", label: "Fiber", target: 30, unit: "g", kind: "goal" },
  { key: "sodium", label: "Sodium", target: 2300, unit: "mg", kind: "limit" },
  { key: "calcium", label: "Calcium", target: 1000, unit: "mg", kind: "goal" },
  { key: "iron", label: "Iron", target: 17, unit: "mg", kind: "goal" },
];

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Scale every nutrient present on `item` by `factor`. Absent micros stay
 *  absent (unknown never becomes zero). */
export function scaleNutrients<
  T extends {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } & Micronutrients,
>(item: T, factor: number): T {
  const scaled: T = { ...item };
  const record = scaled as Record<string, unknown>;

  for (const key of NUTRIENT_KEYS) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      record[key] = round2(value * factor);
    }
  }

  return scaled;
}

/** True when calories disagree with 4·P + 4·C + 9·F by more than a
 *  plausible rounding gap — the signature of per-100 g vs per-portion
 *  mix-ups in an estimate. */
export function isInconsistent(item: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): boolean {
  const implied = 4 * item.protein + 4 * item.carbs + 9 * item.fat;

  return (
    Math.abs(implied - item.calories) > Math.max(60, 0.2 * item.calories)
  );
}
