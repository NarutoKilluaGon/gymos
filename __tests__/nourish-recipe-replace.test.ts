import { saveRecipe } from "@/services/nourish/diary";
import {
  addSavedFood,
  getSavedFoods,
  replaceRecipe,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { DraftItem } from "@/types/nourish";

const SAVED_KEY = "@gymos/saved-foods";

jest.mock("@/storage/storage", () => {
  const state = {
    store: {} as Record<string, string>,
    readDelayMs: 0,
    // When set, every write waits for it before touching the store.
    writeGate: null as Promise<void> | null,
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

  const writeImpl = async (key: string, value: unknown): Promise<void> => {
    if (state.writeGate) await state.writeGate;

    state.store[key] = JSON.stringify(value);
  };

  const setStorage = jest.fn(writeImpl);

  return {
    __state: state,
    __reset() {
      state.store = {};
      state.readDelayMs = 0;
      state.writeGate = null;
      getStorage.mockClear();
      setStorage.mockReset();
      setStorage.mockImplementation(writeImpl);
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
    writeGate: Promise<void> | null;
  };
  __reset(): void;
  setStorage: jest.Mock;
};

beforeEach(() => {
  storageMock.__reset();
});

const draft = (over: Partial<DraftItem> = {}): DraftItem => ({
  name: "Rajma",
  qty: "1 cup",
  calories: 400,
  protein: 24,
  carbs: 60,
  fat: 4,
  confidence: 0.8,
  multiplier: 1,
  source: "ai",
  ...over,
});

/** What is actually persisted, bypassing the repository (and its lock). */
function persisted(): SavedFood[] {
  const raw = storageMock.__state.store[SAVED_KEY];

  return raw === undefined ? [] : (JSON.parse(raw) as SavedFood[]);
}

const recipesNamed = (list: SavedFood[], name: string) =>
  list.filter((f) => f.recipe && f.name.toLowerCase() === name.toLowerCase());

describe("saved recipe replacement atomicity", () => {
  it("replaces in one write with a new id/createdAt and per-serving numbers", async () => {
    const first = await saveRecipe("Rajma", [draft()], 4);

    storageMock.setStorage.mockClear();

    const second = await saveRecipe("rajma", [draft()], 2);

    // Exactly one persisted write for the whole replacement.
    expect(storageMock.setStorage).toHaveBeenCalledTimes(1);
    expect(second.id).not.toBe(first.id);
    expect(second.recipe).toBe(true);
    expect(second.qty).toBe("1 serving");
    expect(second.calories).toBe(200);

    const list = persisted();

    expect(list).toEqual([second]);
  });

  it("a failed write leaves the existing recipe persisted, and the lock is released", async () => {
    const old = await saveRecipe("Rajma", [draft()], 4);
    const before = persisted();

    storageMock.setStorage.mockRejectedValueOnce(new Error("disk full"));

    await expect(saveRecipe("rajma", [draft()], 2)).rejects.toThrow("disk full");

    // Old recipe: still there, untouched, nothing new added.
    expect(persisted()).toEqual(before);
    expect(persisted()).toEqual([old]);
    expect(await getSavedFoods()).toEqual([old]);

    // A later call is not wedged behind the failure.
    const retry = await saveRecipe("rajma", [draft()], 2);

    expect(persisted()).toEqual([retry]);
  });

  it("concurrent same-name saves leave exactly one recipe", async () => {
    // Slow reads widen the window the old get -> delete -> add sequence lost.
    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      saveRecipe("Rajma", [draft()], 4),
      saveRecipe("rajma", [draft()], 2),
      saveRecipe("RAJMA", [draft()], 1),
    ]);

    expect(recipesNamed(persisted(), "rajma")).toHaveLength(1);

    // Same again with an existing recipe already stored.
    await Promise.all([
      saveRecipe("Rajma", [draft()], 4),
      saveRecipe("rajma", [draft()], 2),
    ]);

    expect(recipesNamed(persisted(), "rajma")).toHaveLength(1);
  });

  it("serializes replacements: the later call wins", async () => {
    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      saveRecipe("Rajma", [draft()], 4), // 100 kcal
      saveRecipe("rajma", [draft()], 2), // 200 kcal
    ]);

    const [only] = persisted();

    expect(persisted()).toHaveLength(1);
    expect(only?.calories).toBe(200);
  });

  it("collapses pre-existing duplicate recipes into one", async () => {
    await addSavedFood("Rajma", { calories: 100 }, undefined, {
      recipe: true,
      qty: "1 serving",
    });
    await addSavedFood("rajma", { calories: 110 }, undefined, {
      recipe: true,
      qty: "1 serving",
    });
    expect(recipesNamed(persisted(), "rajma")).toHaveLength(2);

    const replacement = await saveRecipe("Rajma", [draft()], 4);

    expect(persisted()).toEqual([replacement]);
  });

  it("leaves a same-name non-recipe food and saved meal untouched", async () => {
    const food = await addSavedFood("Rajma", { calories: 300 });
    const meal = await addSavedFood(
      "Rajma",
      { calories: 500 },
      [{ name: "Rajma", calories: 500 }] as never,
      { slot: "Lunch" },
    );

    const recipe = await saveRecipe("Rajma", [draft()], 4);
    const list = persisted();

    expect(list).toHaveLength(3);
    expect(list).toContainEqual(food);
    expect(list).toContainEqual(meal);
    expect(list).toContainEqual(recipe);
  });

  it("leaves differently named recipes untouched", async () => {
    const dal = await saveRecipe("Dal", [draft({ name: "Dal" })], 2);

    await saveRecipe("Rajma", [draft()], 4);

    const replacement = await saveRecipe("rajma", [draft()], 2);
    const list = persisted();

    expect(list).toHaveLength(2);
    expect(list).toContainEqual(dal);
    expect(list).toContainEqual(replacement);
  });

  it("a concurrent read never sees the recipe missing mid-replacement", async () => {
    const old = await saveRecipe("Rajma", [draft()], 4);

    // Hold the replacement's single write open.
    let release!: () => void;

    storageMock.__state.writeGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const replacing = replaceRecipe("rajma", { calories: 999 });
    const reading = getSavedFoods();

    // Let both reach their queue positions while the write is held open.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    // Nothing has been persisted yet: the old recipe is still the stored one.
    expect(persisted()).toEqual([old]);

    storageMock.__state.writeGate = null;
    release();

    const replacement = await replacing;
    const seen = await reading;

    // The read queued behind the replacement: it sees the new recipe,
    // never an empty or recipe-less list.
    expect(seen).toEqual([replacement]);
    expect(persisted()).toEqual([replacement]);
  });
});
