import { getAllDailyActivities } from "@/storage/daily";
import type { DailyActivity } from "@/types/gymos";

function isActive(activity: DailyActivity): boolean {
  return (
    activity.water.length > 0 ||
    activity.workouts.length > 0 ||
    activity.meals.length > 0 ||
    activity.sleep.length > 0 ||
    activity.measurements.length > 0 ||
    activity.journal.length > 0
  );
}

function dateKeyAtOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function getStreak(): Promise<number> {
  const all = await getAllDailyActivities();

  let streak = 0;

  for (let offset = 0; offset < 365; offset++) {
    const key = dateKeyAtOffset(offset);
    const activity = all[key];

    if (activity && isActive(activity)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
