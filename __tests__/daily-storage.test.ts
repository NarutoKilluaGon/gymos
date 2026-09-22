import { DAILY_STORAGE_KEY } from "@/storage/constants";
import {
  getAllDailyActivities,
  getDailyActivity,
  readDailyActivityUnlocked,
  saveDailyActivity,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import type { DailyActivity, WaterEntry } from "@/types/gymos";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
    readDelayMs: 0,
    failNextWrites: 0,
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const defaultGetStorage = async (
    key: string,
  ): Promise<unknown> => {
    // Snapshot at call time, then delay: models a reader that grabs
    // the store's state while a competing write is still in flight,
    // so an unserialized transaction ends up persisting stale data.
    const raw = state.store[key];

    if (state.readDelayMs > 0) {
      await sleep(state.readDelayMs);
    }

    return raw === undefined ? null : JSON.parse(raw);
  };

  const defaultSetStorage = async (
    key: string,
    value: unknown,
  ): Promise<void> => {
    if (state.failNextWrites > 0) {
      state.failNextWrites -= 1;
      throw new Error("write failed");
    }

    state.store[key] = JSON.stringify(value);
  };

  const getStorage = jest.fn(defaultGetStorage);
  const setStorage = jest.fn(defaultSetStorage);

  return {
    __state: state,
    __reset() {
      state.store = {};
      state.readDelayMs = 0;
      state.failNextWrites = 0;
      getStorage.mockReset();
      getStorage.mockImplementation(defaultGetStorage);
      setStorage.mockReset();
      setStorage.mockImplementation(defaultSetStorage);
    },
    __seedRaw(key: string, raw: string) {
      state.store[key] = raw;
    },
    __readRaw(key: string): string | undefined {
      return state.store[key];
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
  __state: {
    store: Record<string, string>;
    readDelayMs: number;
    failNextWrites: number;
  };
  __reset(): void;
  __seedRaw(key: string, raw: string): void;
  __readRaw(key: string): string | undefined;
  getStorage: jest.Mock;
  setStorage: jest.Mock;
};

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

function waterEntry(amountMl: number): WaterEntry {
  return {
    id: `w-${amountMl}`,
    amountMl,
    timestamp: "2026-01-01T10:00:00.000Z",
  };
}

function storedStore(): Record<string, unknown> {
  const raw = storageMock.__readRaw(DAILY_STORAGE_KEY);
  return raw === undefined ? {} : JSON.parse(raw);
}

beforeEach(() => {
  storageMock.__reset();
});

describe("daily storage serialization", () => {
  it("keeps both days when two saves overlap on a slow read", async () => {
    storageMock.__state.readDelayMs = 5;

    const dayOne = emptyActivity("2026-04-01");
    dayOne.water.push(waterEntry(250));
    const dayTwo = emptyActivity("2026-04-02");
    dayTwo.water.push(waterEntry(500));

    await Promise.all([
      saveDailyActivity(dayOne),
      saveDailyActivity(dayTwo),
    ]);

    const all = await getAllDailyActivities();
    expect(all["2026-04-01"].water).toHaveLength(1);
    expect(all["2026-04-02"].water).toHaveLength(1);
  });

  it("keeps a concurrent save when another operation migrates a legacy record", async () => {
    storageMock.__seedRaw(
      DAILY_STORAGE_KEY,
      JSON.stringify({ "2025-06-01": { water: 2 } }),
    );
    storageMock.__state.readDelayMs = 5;

    const today = emptyActivity("2026-06-01");
    today.water.push(waterEntry(250));

    await Promise.all([
      getDailyActivity("2025-06-01"),
      saveDailyActivity(today),
    ]);

    const all = await getAllDailyActivities();
    expect(all["2025-06-01"].water[0].amountMl).toBe(2000);
    expect(all["2026-06-01"].water).toHaveLength(1);

    // The save must not have rolled the persisted migration back to
    // its raw legacy shape (in-memory re-migration would hide it).
    const persistedLegacy = storedStore()["2025-06-01"] as DailyActivity;
    expect(Array.isArray(persistedLegacy.water)).toBe(true);
    expect(persistedLegacy.water[0].amountMl).toBe(2000);
  });

  it("serializes full transactions built from the unlocked helpers", async () => {
    storageMock.__state.readDelayMs = 5;
    const date = "2026-05-05";

    const appendWater = (amountMl: number) =>
      withDailyLock(async () => {
        const activity = await readDailyActivityUnlocked(date);
        activity.water.push(waterEntry(amountMl));
        await writeDailyActivityUnlocked(activity);
      });

    // Without the lock both transactions would snapshot the store
    // before either write lands and the first entry would be lost.
    await Promise.all([
      appendWater(250),
      appendWater(500),
    ]);

    const all = await getAllDailyActivities();
    expect(all[date].water.map((entry) => entry.amountMl)).toEqual([
      250, 500,
    ]);
  });

  it("returns a task's result through withDailyLock", async () => {
    await expect(
      withDailyLock(async () => "transaction result"),
    ).resolves.toBe("transaction result");
  });

  it("propagates a failed write to the caller and keeps the lock usable", async () => {
    storageMock.__state.failNextWrites = 1;

    const failed = emptyActivity("2026-07-01");
    failed.water.push(waterEntry(250));

    await expect(saveDailyActivity(failed)).rejects.toThrow(
      "write failed",
    );

    // The rejected operation must not have left the lock held.
    const recovered = emptyActivity("2026-07-02");
    recovered.water.push(waterEntry(500));

    await expect(
      saveDailyActivity(recovered),
    ).resolves.toBeUndefined();

    const all = await getAllDailyActivities();
    expect(all["2026-07-01"]).toBeUndefined();
    expect(all["2026-07-02"].water).toHaveLength(1);
  });

  it("propagates a failed migration write and keeps the lock usable", async () => {
    storageMock.__seedRaw(
      DAILY_STORAGE_KEY,
      JSON.stringify({ "2025-08-01": { water: 3 } }),
    );
    storageMock.__state.failNextWrites = 1;

    await expect(
      getDailyActivity("2025-08-01"),
    ).rejects.toThrow("write failed");

    // Retrying must both succeed and persist the migration.
    const retried = await getDailyActivity("2025-08-01");
    expect(retried.water).toHaveLength(1);
    expect(retried.water[0].amountMl).toBe(3000);

    const raw = storedStore();
    const persisted = raw["2025-08-01"] as DailyActivity;
    expect(persisted.water).toHaveLength(1);
    expect(persisted.water[0].amountMl).toBe(3000);
  });
});

describe("daily storage legacy migration", () => {
  it("migrates a legacy record and persists the result", async () => {
    storageMock.__seedRaw(
      DAILY_STORAGE_KEY,
      JSON.stringify({ "2025-06-01": { water: 2 } }),
    );

    const activity = await getDailyActivity("2025-06-01");
    expect(activity.water).toHaveLength(1);
    expect(activity.water[0].amountMl).toBe(2000);

    const persisted = (
      storedStore()["2025-06-01"] as DailyActivity
    ).water;
    expect(persisted).toHaveLength(1);
    expect(persisted[0].amountMl).toBe(2000);
  });

  it("migrates in memory without persisting on a full read", async () => {
    storageMock.__seedRaw(
      DAILY_STORAGE_KEY,
      JSON.stringify({ "2025-06-01": { water: 2 } }),
    );

    const all = await getAllDailyActivities();
    expect(all["2025-06-01"].water[0].amountMl).toBe(2000);

    // Full reads never write: the raw legacy record is untouched.
    const raw = storedStore()["2025-06-01"] as {
      water: number;
    };
    expect(raw.water).toBe(2);
  });

  it("returns an empty activity for a day that was never stored", async () => {
    const activity = await getDailyActivity("2026-09-22");

    expect(activity).toEqual(emptyActivity("2026-09-22"));
    expect(storageMock.__readRaw(DAILY_STORAGE_KEY)).toBeUndefined();
  });
});

describe("lost-update hazard (documents why the lock exists)", () => {
  it("loses the first write when two snapshots are taken before either write lands", async () => {
    // Both snapshots are taken before any write, which is exactly the
    // interleaving `withDailyLock` now forbids. The later, stale
    // snapshot overwrites the first day wholesale.
    const snapshotOne =
      ((await storageMock.getStorage(DAILY_STORAGE_KEY)) as Record<
        string,
        DailyActivity
      >) ?? {};
    const snapshotTwo =
      ((await storageMock.getStorage(DAILY_STORAGE_KEY)) as Record<
        string,
        DailyActivity
      >) ?? {};

    const dayOne = emptyActivity("2026-03-01");
    dayOne.water.push(waterEntry(250));
    snapshotOne[dayOne.date] = dayOne;

    const dayTwo = emptyActivity("2026-03-02");
    dayTwo.water.push(waterEntry(500));
    snapshotTwo[dayTwo.date] = dayTwo;

    await storageMock.setStorage(DAILY_STORAGE_KEY, snapshotOne);
    await storageMock.setStorage(DAILY_STORAGE_KEY, snapshotTwo);

    const stored = storedStore();
    expect(stored["2026-03-01"]).toBeUndefined(); // lost
    expect(stored["2026-03-02"]).toBeDefined();
  });
});
