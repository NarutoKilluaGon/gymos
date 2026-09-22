import { getStreak } from "@/services/streak";
import type { DailyActivity } from "@/types/gymos";

jest.mock("@/storage/daily", () => ({
  getAllDailyActivities: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAllDailyActivities } = require("@/storage/daily") as {
  getAllDailyActivities: jest.Mock;
};

function keyAtOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyActivity(date: string): DailyActivity {
  return {
    date,
    water: [],
    workouts: [],
    meals: [],
    sleep: [],
    measurements: [],
    journal: [],
  };
}

function activeActivity(date: string): DailyActivity {
  return {
    ...emptyActivity(date),
    water: [
      {
        id: "w1",
        amountMl: 250,
        timestamp: new Date(`${date}T10:00:00`).toISOString(),
      },
    ],
  };
}

describe("getStreak", () => {
  beforeEach(() => {
    getAllDailyActivities.mockReset();
  });

  it("returns 0 and todayActive false when nothing has ever been logged", async () => {
    getAllDailyActivities.mockResolvedValue({});
    await expect(getStreak()).resolves.toEqual({
      days: 0,
      todayActive: false,
    });
  });

  it("counts consecutive active days back from today", async () => {
    const data: Record<string, DailyActivity> = {
      [keyAtOffset(0)]: activeActivity(keyAtOffset(0)),
      [keyAtOffset(1)]: activeActivity(keyAtOffset(1)),
      [keyAtOffset(2)]: activeActivity(keyAtOffset(2)),
      [keyAtOffset(3)]: emptyActivity(keyAtOffset(3)),
    };

    getAllDailyActivities.mockResolvedValue(data);

    await expect(getStreak()).resolves.toEqual({
      days: 3,
      todayActive: true,
    });
  });

  it("preserves the streak through an empty today instead of resetting", async () => {
    const data: Record<string, DailyActivity> = {
      [keyAtOffset(0)]: emptyActivity(keyAtOffset(0)),
      [keyAtOffset(1)]: activeActivity(keyAtOffset(1)),
      [keyAtOffset(2)]: activeActivity(keyAtOffset(2)),
    };

    getAllDailyActivities.mockResolvedValue(data);

    await expect(getStreak()).resolves.toEqual({
      days: 2,
      todayActive: false,
    });
  });

  it("breaks the streak at the first inactive completed day", async () => {
    const data: Record<string, DailyActivity> = {
      [keyAtOffset(0)]: emptyActivity(keyAtOffset(0)),
      [keyAtOffset(1)]: emptyActivity(keyAtOffset(1)),
      [keyAtOffset(2)]: activeActivity(keyAtOffset(2)),
    };

    getAllDailyActivities.mockResolvedValue(data);

    await expect(getStreak()).resolves.toEqual({
      days: 0,
      todayActive: false,
    });
  });

  it("a day with a logged meal still counts as active", async () => {
    const day0 = keyAtOffset(0);
    const activity = emptyActivity(day0);

    activity.meals.push({
      id: "m1",
      name: "Chicken rice",
      calories: 580,
      protein: 40,
      carbs: 65,
      fat: 12,
      timestamp: new Date(`${day0}T12:00:00`).toISOString(),
    });

    getAllDailyActivities.mockResolvedValue({ [day0]: activity });

    await expect(getStreak()).resolves.toEqual({
      days: 1,
      todayActive: true,
    });
  });
});