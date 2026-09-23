import AsyncStorage from "@react-native-async-storage/async-storage";

const WEIGHT_UNIT_KEY = "@gymos/weight-unit";

export type WeightUnit = "kg" | "lb";

export async function getWeightUnit(): Promise<WeightUnit> {
  try {
    const value = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
    if (value === "lb") return "lb";
    return "kg";
  } catch {
    return "kg";
  }
}

export async function setWeightUnit(unit: WeightUnit): Promise<void> {
  await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

const KG_TO_LB = 2.20462;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "kg" ? value * KG_TO_LB : value / KG_TO_LB;
}
