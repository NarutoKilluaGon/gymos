import AsyncStorage from "@react-native-async-storage/async-storage";

import { finish, reopen } from "@/services/forge/timing";
import { getStreak } from "@/services/streak";
import { addCardioLog, removeCardioLog } from "@/storage/repositories/nourish-cardio";
import { deleteSession, saveSession } from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";

/** The real repositories over the AsyncStorage mock: what Forge actually writes. */
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const TODAY = "2026-06-15";

const done = (id: string, date: string): WorkoutSession => ({
  id,
  name: "Upper",
  date,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  exercises: [
    {
      id: "e1",
      exerciseId: "bench",
      name: "Bench",
      sets: [{ id: "s1", reps: 5, weight: 60, completed: true }],
    },
  ],
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("streak follows Forge writes", () => {
  it("is empty before anything is logged", async () => {
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });
  });

  it("an unfinished workout does not count; finishing it does", async () => {
    const open: WorkoutSession = { ...done("w1", TODAY) };

    delete open.endedAt;
    await saveSession(open);
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });

    await saveSession(done("w1", TODAY));
    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });
  });

  it("finishing a workout with nothing completed does not count", async () => {
    const { session: closed } = finish(
      {
        ...done("w2", TODAY),
        endedAt: undefined,
        exercises: [
          {
            id: "e1",
            exerciseId: "bench",
            name: "Bench",
            sets: [{ id: "s1", reps: 5, weight: 60, completed: false }],
          },
        ],
      },
      new Date(`${TODAY}T10:05:00.000Z`),
    );

    await saveSession(closed);
    expect(closed.endedAt).toBeDefined();
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });
  });

  it("deleting a workout updates the streak", async () => {
    await saveSession(done("a", TODAY));
    await saveSession(done("b", "2026-06-14"));
    await expect(getStreak(NOW)).resolves.toEqual({ days: 2, todayActive: true });

    await deleteSession("a");
    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: false });

    await deleteSession("b");
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });
  });

  it("deleting one of two workouts on a day keeps the day", async () => {
    await saveSession(done("a", TODAY));
    await saveSession(done("b", TODAY));
    await deleteSession("a");

    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });
  });

  it("reopening a completed workout updates the streak; re-finishing restores it", async () => {
    const finished = done("r1", TODAY);

    await saveSession(finished);
    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });

    const reopened = reopen(finished, new Date(`${TODAY}T11:30:00.000Z`));

    await saveSession(reopened);
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });

    await saveSession(done("r1", TODAY));
    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });
  });

  it("a reopened past workout breaks the run through that day", async () => {
    await saveSession(done("t", TODAY));
    await saveSession(done("y", "2026-06-14"));
    await saveSession(done("d", "2026-06-13"));

    await saveSession(
      reopen(done("y", "2026-06-14"), new Date(`${TODAY}T09:00:00.000Z`)),
    );

    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });
  });

  it("a cardio-only day counts, and removing the entry takes it back out", async () => {
    const log = await addCardioLog(TODAY, {
      name: "Run",
      detail: "5 km",
      minutes: 30,
      kcal: 300,
    });

    await expect(getStreak(NOW)).resolves.toEqual({ days: 1, todayActive: true });

    await removeCardioLog(TODAY, log.id);
    await expect(getStreak(NOW)).resolves.toEqual({ days: 0, todayActive: false });
  });

  it("re-reads the clock on every call instead of holding yesterday's answer", async () => {
    await saveSession(done("k", "2026-06-15"));

    await expect(getStreak(new Date(2026, 5, 15, 23, 59, 0))).resolves.toEqual({
      days: 1,
      todayActive: true,
    });
    await expect(getStreak(new Date(2026, 5, 16, 0, 1, 0))).resolves.toEqual({
      days: 1,
      todayActive: false,
    });
    await expect(getStreak(new Date(2026, 5, 17, 0, 1, 0))).resolves.toEqual({
      days: 0,
      todayActive: false,
    });
  });
});
