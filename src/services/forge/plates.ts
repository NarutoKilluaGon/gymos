import type { WeightUnit } from "@/services/forge/load";

const PLATES: Record<WeightUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export const DEFAULT_BAR: Record<WeightUnit, number> = { kg: 20, lb: 45 };

export type PlateResult = {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** Weight that can't be made with the plates available (whole bar). */
  leftover: number;
  /** The target is lighter than the empty bar. */
  belowBar: boolean;
};

/** Greedy plate loading for one side of the bar, in `unit`. */
export function platesFor(
  target: number,
  bar: number,
  unit: WeightUnit,
): PlateResult {
  if (!(target > bar)) {
    return { perSide: [], leftover: 0, belowBar: target < bar };
  }

  let side = (target - bar) / 2;
  const perSide: number[] = [];

  for (const plate of PLATES[unit]) {
    while (side + 1e-9 >= plate) {
      perSide.push(plate);
      side -= plate;
    }
  }

  return {
    perSide,
    leftover: Math.round(side * 2 * 100) / 100,
    belowBar: false,
  };
}
