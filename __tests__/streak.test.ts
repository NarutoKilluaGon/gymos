import { getStreak } from "@/services/streak";
import type { DailyActivity } from "@/types/gymos";

jest.mock("@/storage/daily", () => ({
  getAllDailyActivities: jest.fn(),
}));

jest.mock("@/storage/repositories/meals", () => ({
  getMealDateKeys: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAllDailyActivities } = require("@/storage/daily") as {
  getAllDailyActivities: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getMealDateKeys } = require("@/storage/repositories/meals") as {
  getMealDateKeys: jest.Mock;
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
    getMealDateKeys.mockReset();
    // Meals now come from their own store (meals.ts), not
    // `activity.meals` — most tests here aren't exercising meals at
    // all, so default to "no meal-active days" and let the one test
    // that does care override this.
    getMealDateKeys.mockResolvedValue(new Set());
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

    // The day's DailyActivity itself is otherwise empty — meals live in
    // their own store now, so activity alone should not be enough, and
    // isn't: only getMealDateKeys() reporting today makes this active.
    getAllDailyActivities.mockResolvedValue({
      [day0]: emptyActivity(day0),
    });
    getMealDateKeys.mockResolvedValue(new Set([day0]));

    await expect(getStreak()).resolves.toEqual({
      days: 1,
      todayActive: true,
    });
  });

  it("a logged meal counts as active even with no DailyActivity record at all", async () => {
    const day0 = keyAtOffset(0);

    // No entry for today whatsoever — not even an empty one. A meal is
    // now the only signal for the day, and must still count.
    getAllDailyActivities.mockResolvedValue({});
    getMealDateKeys.mockResolvedValue(new Set([day0]));

    await expect(getStreak()).resolves.toEqual({
      days: 1,
      todayActive: true,
    });
  });
});