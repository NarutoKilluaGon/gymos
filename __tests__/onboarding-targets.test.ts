import {
  calculateTargets,
  type BodyProfile,
} from "@/services/onboarding/targets";

describe("Onboarding Mifflin-St Jeor target calculations", () => {
  it("calculates accurate targets for a male building muscle", () => {
    const profile: BodyProfile = {
      weightKg: 80,
      heightCm: 180,
      age: 25,
      sex: "male",
      activityLevel: "moderate", // 1.55
      goal: "buildMuscle", // +300 kcal, 2.0 g/kg protein
    };

    // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    // TDEE = 1805 * 1.55 = 2797.75 -> 2798
    // kcal = 2798 + 300 = 3098
    // protein = 80 * 2.0 = 160
    const result = calculateTargets(profile);
    expect(result.bmr).toBe(1805);
    expect(result.tdee).toBe(2798);
    expect(result.kcal).toBe(3098);
    expect(result.protein).toBe(160);
    expect(result.weeklyRate).toBe(0.25);
    expect(result.split).toBe("45,25");
  });

  it("calculates accurate targets for a female losing fat", () => {
    const profile: BodyProfile = {
      weightKg: 65,
      heightCm: 165,
      age: 30,
      sex: "female",
      activityLevel: "light", // 1.375
      goal: "loseFat", // -450 kcal, 2.2 g/kg protein
    };

    // BMR = 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25 -> 1370
    // TDEE = 1370 * 1.375 = 1883.75 -> 1884
    // kcal = 1884 - 450 = 1434
    // protein = 65 * 2.2 = 143
    const result = calculateTargets(profile);
    expect(result.bmr).toBe(1370);
    expect(result.tdee).toBe(1884);
    expect(result.kcal).toBe(1434);
    expect(result.protein).toBe(143);
    expect(result.weeklyRate).toBe(-0.5);
    expect(result.split).toBe("40,30");
  });

  it("enforces safe calorie minimums", () => {
    const extremeDeficitProfile: BodyProfile = {
      weightKg: 45,
      heightCm: 150,
      age: 40,
      sex: "female",
      activityLevel: "sedentary",
      goal: "loseFat",
    };

    const result = calculateTargets(extremeDeficitProfile);
    expect(result.kcal).toBeGreaterThanOrEqual(1200);
  });

  it("handles unspecified sex with midpoint and safe bounds", () => {
    const profile: BodyProfile = {
      weightKg: 75,
      heightCm: 175,
      age: 28,
      sex: "unspecified",
      activityLevel: "moderate",
      goal: "stayConsistent",
    };

    const result = calculateTargets(profile);
    expect(result.kcal).toBeGreaterThan(1500);
    expect(result.protein).toBe(Math.round(75 * 1.6));
    expect(result.weeklyRate).toBe(0);
  });

  it("clamps extreme inputs cleanly", () => {
    const clampProfile: BodyProfile = {
      weightKg: 500, // clamped to 300
      heightCm: 300, // clamped to 250
      age: 120, // clamped to 100
      sex: "male",
      activityLevel: "heavy",
      goal: "getStronger",
    };

    const result = calculateTargets(clampProfile);
    expect(result.kcal).toBeLessThanOrEqual(4500);
    expect(result.protein).toBeLessThanOrEqual(300);
  });
});
