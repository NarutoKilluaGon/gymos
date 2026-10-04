import { getAllDailyActivities } from "@/storage/daily";

export type ExercisePerformance = {
  workoutId: string;
  workoutName: string;
  exerciseId: string;
  exerciseName: string;
  setId: string;
  weight?: number;
  unit?: "kg" | "lb";
  reps: number;
  completed: boolean;
  timestamp: string;
};

export type ExerciseSummary = {
  exerciseId: string;
  exerciseName: string;
};

export async function getExercisesWithHistory(): Promise<
  ExerciseSummary[]
> {
  const data = await getAllDailyActivities();

  const seen = new Map<string, string>();

  for (const activity of Object.values(data)) {
    if (!activity?.workouts) continue;

    for (const workout of activity.workouts) {
      if (!workout.endedAt) continue;

      for (const exercise of workout.exercises) {
        if (!seen.has(exercise.exerciseId)) {
          seen.set(
            exercise.exerciseId,
            exercise.name,
          );
        }
      }
    }
  }

  return Array.from(seen, ([exerciseId, exerciseName]) => ({
    exerciseId,
    exerciseName,
  })).sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName),
  );
}

export async function getExerciseHistory(
  exerciseId: string,
): Promise<ExercisePerformance[]> {
  const data = await getAllDailyActivities();

  const results: ExercisePerformance[] = [];

  for (const activity of Object.values(data)) {
    if (!activity?.workouts) {
      continue;
    }

    for (const workout of activity.workouts) {
      if (!workout.endedAt) {
        continue;
      }

      for (const exercise of workout.exercises) {
        if (exercise.exerciseId !== exerciseId) {
          continue;
        }

        for (const set of exercise.sets) {
          // Warm-ups and sets that were never done aren't performance.
          if (set.warmup || !set.completed) continue;

          results.push({
            workoutId: workout.id,
            workoutName: workout.name,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.name,
            setId: set.id,
            weight: set.weight,
            unit: set.unit,
            reps: set.reps,
            completed: set.completed,
            timestamp: workout.startedAt,
          });
        }
      }
    }
  }

  return results.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime(),
  );
}
