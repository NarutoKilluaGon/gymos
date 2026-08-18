import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import { Greeting } from "@/components/dashboard/greeting";
import { NorthStarCard } from "@/components/dashboard/north-star-card";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { GymFAB } from "@/components/fab/gym-fab";
import { GymColors, Spacing } from "@/constants/theme";
import { addMeasurement } from "@/storage/repositories/measurements";
import { getNorthStar } from "@/storage/repositories/north-star";
import { addWater, getTodayWater } from "@/storage/repositories/water";
import type { NorthStar } from "@/types/gymos";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const DEFAULT_WATER = 0;

export default function HomeScreen() {
  const [water, setWater] = useState(DEFAULT_WATER);

  const [northStar, setNorthStar] = useState<NorthStar | null>(null);

  useEffect(() => {
    async function loadHome() {
      const totalWaterMl = await getTodayWater();

      setWater(totalWaterMl / 1000);

      const storedNorthStar = await getNorthStar();

      setNorthStar(storedNorthStar);
    }

    loadHome();
  }, []);

  async function handleWaterAdd(amountLitres: number) {
    const amountMl = amountLitres * 1000;

    await addWater(amountMl);

    const totalWaterMl = await getTodayWater();

    setWater(totalWaterMl / 1000);
  }

  async function handleWeightAdd(weight: number) {
    await addMeasurement("weight", weight, "kg");
  }

  return (
    <View style={styles.container}>
      <Greeting text="Good evening" />

      <WorkoutCard workoutName="Push" message="Pick up where you left off." />

      {northStar && (
        <NorthStarCard northStar={northStar} onNorthStarChange={setNorthStar} />
      )}

      <DailyTargetsCard water={water} sleep="7h 12m" steps="6,430" />

      <SuggestionCard message="Today's workout is Push." />

      <GymFAB onWaterAdd={handleWaterAdd} onWeightAdd={handleWeightAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
