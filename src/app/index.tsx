import { DailyTargetsCard } from "@/components/dashboard/daily-targets-card";
import { Greeting } from "@/components/dashboard/greeting";
import {
  NorthStarCard,
  type NorthStar,
} from "@/components/dashboard/north-star-card";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { GymFAB } from "@/components/fab/gym-fab";
import { GymColors, Spacing } from "@/constants/theme";
import { addWater, getTodayWater } from "@/storage/repositories/water";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const DEFAULT_WATER = 0;

export default function HomeScreen() {
  const [water, setWater] = useState(DEFAULT_WATER);

  const northStar: NorthStar = {
    title: "18 inch biceps",
    metric: {
      name: "Biceps",
      current: 16.2,
      target: 18,
      unit: "in",
    },
    why: "Build the physique I want.",
  };

  useEffect(() => {
    async function loadToday() {
      const totalWaterMl = await getTodayWater();

      setWater(totalWaterMl / 1000);
    }

    loadToday();
  }, []);

  async function handleWaterAdd(amountLitres: number) {
    const amountMl = amountLitres * 1000;

    await addWater(amountMl);

    const totalWaterMl = await getTodayWater();

    setWater(totalWaterMl / 1000);
  }

  return (
    <View style={styles.container}>
      <Greeting text="Good evening" />

      <WorkoutCard workoutName="Push" message="Pick up where you left off." />

      <NorthStarCard northStar={northStar} />

      <DailyTargetsCard water={water} sleep="7h 12m" steps="6,430" />

      <SuggestionCard message="Today's workout is Push." />

      <GymFAB onWaterAdd={handleWaterAdd} />
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
