import { getAllDailyActivities } from "@/storage/daily";
import {
  addMeasurement,
  deleteMeasurement,
  getMeasurements,
  replaceTodayWeight,
} from "@/storage/repositories/measurements";
import { addDaysToKey, dateKeyFromTimestamp, getTodayKey } from "@/utils/date";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
    readDelayMs: 0,
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const getStorage = jest.fn(async (key: string): Promise<unknown> => {
    // Snapshot at call time, then delay: models a reader holding a stale view
    // while a competing write is still in flight.
    const raw = state.store[key];

    if (state.readDelayMs > 0) await sleep(state.readDelayMs);

    return raw === undefined ? null : JSON.parse(raw);
  });

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
      setStorage.mockReset();
      setStorage.mockImplementation(async (key: string, value: unknown) => {
        state.store[key] = JSON.stringify(value);
      });
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
  setStorage: jest.Mock;
};

const todayWeights = async () => {
  const today = (await getAllDailyActivities())[getTodayKey()];

  return (today?.measurements ?? []).filter((m) => m.type === "weight");
};

beforeEach(() => {
  storageMock.__reset();
});

describe("the old logWeight sequence (find, delete, add) is not atomic", () => {
  // Documents the bug the repository operation replaces: this is exactly what
  // logWeight used to do from the hook, minus React.
  const oldLogWeight = async (value: number) => {
    const [existing] = (await getMeasurements("weight")).filter(
      (m) => dateKeyFromTimestamp(m.timestamp) === getTodayKey(),
    );

    if (existing) await deleteMeasurement(existing.id);

    await addMeasurement("weight", value, "kg");
  };

  it("leaves two readings for one day when two calls overlap", async () => {
    await addMeasurement("weight", 80, "kg");
    storageMock.__state.readDelayMs = 5;

    await Promise.all([oldLogWeight(81), oldLogWeight(82)]);

    expect((await todayWeights()).length).toBeGreaterThan(1);
  });
});

describe("replaceTodayWeight", () => {
  it("adds the first reading of the day", async () => {
    const saved = await replaceTodayWeight(80, "kg");

    expect(await todayWeights()).toEqual([saved]);
  });

  it("replaces the existing reading instead of adding a second", async () => {
    const first = await addMeasurement("weight", 80, "kg");
    const saved = await replaceTodayWeight(79.5, "kg");
    const weights = await todayWeights();

    expect(weights).toHaveLength(1);
    expect(weights[0]).toMatchObject({ id: saved.id, value: 79.5, unit: "kg" });
    expect(weights[0].id).not.toBe(first.id);
  });

  it("keeps exactly one reading when two replacements race", async () => {
    await addMeasurement("weight", 80, "kg");
    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      replaceTodayWeight(81, "kg"),
      replaceTodayWeight(82, "kg"),
    ]);

    const weights = await todayWeights();

    expect(weights).toHaveLength(1);
    // Calls serialize in order, so the later call wins.
    expect(weights[0].value).toBe(82);
  });

  it("keeps exactly one reading when many replacements race from empty", async () => {
    storageMock.__state.readDelayMs = 3;

    await Promise.all([
      replaceTodayWeight(70, "kg"),
      replaceTodayWeight(71, "kg"),
      replaceTodayWeight(72, "kg"),
    ]);

    expect(await todayWeights()).toHaveLength(1);
  });

  it("collapses duplicate readings already stored for today", async () => {
    await addMeasurement("weight", 80, "kg");
    await addMeasurement("weight", 81, "kg");
    expect(await todayWeights()).toHaveLength(2);

    await replaceTodayWeight(79, "kg");

    const weights = await todayWeights();

    expect(weights).toHaveLength(1);
    expect(weights[0].value).toBe(79);
  });

  it("leaves other measurement types and other days alone", async () => {
    const waist = await addMeasurement("waist", 90, "cm");
    const yesterday = addDaysToKey(getTodayKey(), -1);

    // A reading stored under a previous day must survive.
    const stored = JSON.parse(
      storageMock.__state.store["@gymos/daily"] ?? "{}",
    ) as Record<string, unknown>;

    stored[yesterday] = {
      date: yesterday,
      water: [],
      workouts: [],
      meals: [],
      sleep: [],
      journal: [],
      measurements: [
        {
          id: "old-weight",
          type: "weight",
          value: 85,
          unit: "kg",
          timestamp: new Date(`${yesterday}T12:00:00`).toISOString(),
        },
      ],
    };
    storageMock.__state.store["@gymos/daily"] = JSON.stringify(stored);

    await replaceTodayWeight(79, "kg");

    const all = await getAllDailyActivities();

    expect(all[getTodayKey()].measurements.map((m) => m.id)).toContain(waist.id);
    expect(all[yesterday].measurements.map((m) => m.id)).toEqual(["old-weight"]);
  });

  it("a failed write leaves the previous reading in place", async () => {
    const existing = await addMeasurement("weight", 80, "kg");

    storageMock.setStorage.mockRejectedValueOnce(new Error("disk full"));

    await expect(replaceTodayWeight(79, "kg")).rejects.toThrow("disk full");

    expect(await todayWeights()).toEqual([existing]);

    // The lock is released: a later call works.
    const saved = await replaceTodayWeight(78, "kg");

    expect(await todayWeights()).toEqual([saved]);
  });
});
