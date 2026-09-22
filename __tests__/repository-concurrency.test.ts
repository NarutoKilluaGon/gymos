import {
  getAllDailyActivities,
} from "@/storage/daily";
import { getTodayKey } from "@/utils/date";
import { addMeasurement, deleteMeasurement } from "@/storage/repositories/measurements";
import { addWater, getTodayWater } from "@/storage/repositories/water";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
    readDelayMs: 0,
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const getStorage = jest.fn(
    async (key: string): Promise<unknown> => {
      // Snapshot at call time, then delay — models a reader holding
      // a stale view while a competing write is still in flight.
      const raw = state.store[key];

      if (state.readDelayMs > 0) {
        await sleep(state.readDelayMs);
      }

      return raw === undefined ? null : JSON.parse(raw);
    },
  );

  const setStorage = jest.fn(
    async (key: string, value: unknown): Promise<void> => {
      state.store[key] = JSON.stringify(value);
    },
  );

  return {
    __state: state,
    __reset() {
      state.store = {};
      state.readDelayMs = 0;
      getStorage.mockClear();
      setStorage.mockClear();
    },
    getStorage,
    setStorage,
    removeStorage: jest.fn(async (key: string) => {
      delete state.store[key];
    }),
    StorageError: class StorageError extends Error {},
  };
});

const storageMock = jest.requireMock("@/storage/storage") as {
  __state: { store: Record<string, string>; readDelayMs: number };
  __reset(): void;
};

beforeEach(() => {
  storageMock.__reset();
});

describe("repository transaction serialization", () => {
  it("completes a repository mutation (nested lock would hang here)", async () => {
    const entry = await addWater(250);

    expect(entry.amountMl).toBe(250);
    expect(await getTodayWater()).toBe(250);
  });

  it("keeps both entries when two water logs race", async () => {
    storageMock.__state.readDelayMs = 5;

    await Promise.all([addWater(250), addWater(500)]);

    const all = await getAllDailyActivities();
    const today = all[getTodayKey()];

    expect(
      today.water.map((entry) => entry.amountMl).sort((a, b) => a - b),
    ).toEqual([250, 500]);
  });

  it("keeps water and a measurement logged concurrently on the same day", async () => {
    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      addWater(250),
      addMeasurement("weight", 80, "kg"),
    ]);

    const all = await getAllDailyActivities();
    const today = all[getTodayKey()];

    expect(today.water).toHaveLength(1);
    expect(today.measurements).toHaveLength(1);
  });

  it("keeps a concurrent water log while a measurement is deleted", async () => {
    const measurement = await addMeasurement("weight", 80, "kg");
    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      deleteMeasurement(measurement.id),
      addWater(250),
    ]);

    const all = await getAllDailyActivities();
    const today = all[getTodayKey()];

    expect(today.measurements).toHaveLength(0);
    expect(today.water).toHaveLength(1);
  });
});
