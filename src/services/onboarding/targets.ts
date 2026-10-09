export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "heavy";
export type OnboardingGoal =
  | "buildMuscle"
  | "loseFat"
  | "getStronger"
  | "stayConsistent";

export type BodyProfile = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex?: Sex;
  activityLevel: ActivityLevel;
  goal: OnboardingGoal;
};

export type OnboardingTargets = {
  kcal: number;
  protein: number;
  split: "45,25" | "40,30" | "50,20";
  weeklyRate: number;
  fallbackWeightKg: number;
  bmr: number;
  tdee: number;
};

export const DEFAULT_BODY_PROFILE: BodyProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 26,
  sex: "unspecified",
  activityLevel: "moderate",
  goal: "buildMuscle",
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  heavy: 1.725,
};

const GOAL_CALORIE_DELTAS: Record<OnboardingGoal, number> = {
  buildMuscle: 300,
  loseFat: -450,
  getStronger: 100,
  stayConsistent: 0,
};

const GOAL_WEEKLY_RATES: Record<OnboardingGoal, number> = {
  buildMuscle: 0.25,
  loseFat: -0.5,
  getStronger: 0.1,
  stayConsistent: 0,
};

const GOAL_PROTEIN_MULTIPLIERS: Record<OnboardingGoal, number> = {
  buildMuscle: 2.0,
  loseFat: 2.2,
  getStronger: 2.0,
  stayConsistent: 1.6,
};

/**
 * Calculate personalized daily nutritional targets using the Mifflin–St Jeor formula
 * adjusted for activity multiplier and body composition goal.
 */
export function calculateTargets(profile: BodyProfile): OnboardingTargets {
  const weight = Math.max(30, Math.min(300, profile.weightKg));
  const height = Math.max(100, Math.min(250, profile.heightCm));
  const age = Math.max(14, Math.min(100, profile.age));
  const sex = profile.sex ?? "unspecified";
  const activity = profile.activityLevel ?? "moderate";
  const goal = profile.goal ?? "buildMuscle";

  // 1. Mifflin–St Jeor Basal Metabolic Rate (BMR)
  let bmrBase = 10 * weight + 6.25 * height - 5 * age;
  let bmr: number;
  if (sex === "male") {
    bmr = bmrBase + 5;
  } else if (sex === "female") {
    bmr = bmrBase - 161;
  } else {
    // Unspecified: neutral midpoint
    bmr = bmrBase - 78;
  }
  bmr = Math.round(bmr);

  // 2. Total Daily Energy Expenditure (TDEE)
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activity] ?? 1.55;
  const tdee = Math.round(bmr * activityMultiplier);

  // 3. Goal calorie adjustment
  const delta = GOAL_CALORIE_DELTAS[goal] ?? 0;
  let targetKcal = tdee + delta;

  // Safe bounds: minimum 1200 for women, 1500 for men/unspecified, max 4500
  const minKcal = sex === "female" ? 1200 : 1500;
  targetKcal = Math.max(minKcal, Math.min(4500, targetKcal));

  // 4. Protein calculation based on body weight
  const proteinMultiplier = GOAL_PROTEIN_MULTIPLIERS[goal] ?? 2.0;
  let targetProtein = Math.round(weight * proteinMultiplier);
  targetProtein = Math.max(60, Math.min(300, targetProtein));

  // 5. Carb & Fat split
  const split: "45,25" | "40,30" | "50,20" =
    goal === "buildMuscle" || goal === "getStronger" ? "45,25" : "40,30";

  return {
    kcal: Math.round(targetKcal),
    protein: targetProtein,
    split,
    weeklyRate: GOAL_WEEKLY_RATES[goal] ?? 0,
    fallbackWeightKg: Math.round(weight * 10) / 10,
    bmr,
    tdee,
  };
}
