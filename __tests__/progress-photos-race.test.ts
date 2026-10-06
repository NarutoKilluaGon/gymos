import {
  addProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotos,
} from "@/storage/repositories/progress-photos";
import { getTodayKey } from "@/utils/date";

jest.mock("expo-file-system", () => {
  // Minimal in-memory file system: just what progress-photos.ts touches.
  const fs = {
    files: new Set<string>(),
    dirs: new Set<string>(),
    copies: [] as { from: string; to: string }[],
    // Per source-URI gate: copy() waits for it, modelling a slow copy.
    copyGates: new Map<string, Promise<void>>(),
  };

  const join = (base: string | { uri: string }, name?: string) => {
    const root = typeof base === "string" ? base : base.uri;

    return name === undefined ? root : `${root}/${name}`;
  };

  class MockDirectory {
    uri: string;

    constructor(base: string | { uri: string }, name?: string) {
      this.uri = join(base, name);
    }

    get exists() {
      return fs.dirs.has(this.uri);
    }

    create() {
      fs.dirs.add(this.uri);
    }
  }

  class MockFile {
    uri: string;

    constructor(base: string | { uri: string }, name?: string) {
      this.uri = join(base, name);
    }

    get exists() {
      return fs.files.has(this.uri);
    }

    async copy(destination: { uri: string }) {
      const gate = fs.copyGates.get(this.uri);

      if (gate) await gate;

      fs.copies.push({ from: this.uri, to: destination.uri });
      fs.files.add(destination.uri);
    }

    delete() {
      fs.files.delete(this.uri);
    }
  }

  return {
    __fs: fs,
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: "file:///document" },
  };
});

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

  const writeImpl = async (key: string, value: unknown): Promise<void> => {
    state.store[key] = JSON.stringify(value);
  };

  const setStorage = jest.fn(writeImpl);

  return {
    __state: state,
    __reset() {
      state.store = {};
      state.readDelayMs = 0;
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

const fsMock = (
  jest.requireMock("expo-file-system") as {
    __fs: {
      files: Set<string>;
      dirs: Set<string>;
      copies: { from: string; to: string }[];
      copyGates: Map<string, Promise<void>>;
    };
  }
).__fs;

const storageMock = jest.requireMock("@/storage/storage") as {
  __state: { store: Record<string, string>; readDelayMs: number };
  __reset(): void;
  setStorage: jest.Mock;
};

const PHOTOS_KEY = "@gymos/progress-photos";

/** Persisted record ids, bypassing the repository. */
function persistedIds(): string[] {
  const raw = storageMock.__state.store[PHOTOS_KEY];

  return raw === undefined
    ? []
    : (JSON.parse(raw) as { id: string }[]).map((p) => p.id).sort();
}

/** Register a picked source photo in the in-memory file system. */
function pick(name: string): string {
  const uri = `file:///picker/${name}.jpg`;

  fsMock.files.add(uri);

  return uri;
}

beforeEach(() => {
  storageMock.__reset();
  fsMock.files.clear();
  fsMock.dirs.clear();
  fsMock.copies.length = 0;
  fsMock.copyGates.clear();
});

describe("progress photo records: serialized read-modify-write", () => {
  it("two concurrent adds persist both records", async () => {
    // Slow reads widen the window the unlocked read -> write lost.
    storageMock.__state.readDelayMs = 5;

    const [a, b] = await Promise.all([
      addProgressPhoto(pick("a")),
      addProgressPhoto(pick("b")),
    ]);

    expect(a.id).not.toBe(b.id);
    expect(persistedIds()).toEqual([a.id, b.id].sort());
    expect((await getProgressPhotos()).map((p) => p.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
  });

  it("many concurrent adds lose nothing", async () => {
    storageMock.__state.readDelayMs = 3;

    const added = await Promise.all(
      ["a", "b", "c", "d", "e"].map((n) => addProgressPhoto(pick(n))),
    );

    expect(persistedIds()).toEqual(added.map((p) => p.id).sort());
  });

  it("a concurrent add and delete keep both effects (no lost or resurrected record)", async () => {
    const old = await addProgressPhoto(pick("old"));

    storageMock.__state.readDelayMs = 5;

    const [added] = await Promise.all([
      addProgressPhoto(pick("new")),
      deleteProgressPhoto(old.id),
    ]);

    // The new photo is there and the deleted one did not come back.
    expect(persistedIds()).toEqual([added.id]);
    expect(fsMock.files.has(old.uri)).toBe(false);
    expect(fsMock.files.has(added.uri)).toBe(true);
  });

  it("concurrent deletes of different photos remove both", async () => {
    const one = await addProgressPhoto(pick("one"));
    const two = await addProgressPhoto(pick("two"));
    const keep = await addProgressPhoto(pick("keep"));

    storageMock.__state.readDelayMs = 5;

    await Promise.all([
      deleteProgressPhoto(one.id),
      deleteProgressPhoto(two.id),
    ]);

    expect(persistedIds()).toEqual([keep.id]);
  });

  it("a failed record write releases the lock: a later add succeeds", async () => {
    const before = await addProgressPhoto(pick("before"));

    storageMock.setStorage.mockRejectedValueOnce(new Error("disk full"));

    await expect(addProgressPhoto(pick("fails"))).rejects.toThrow("disk full");

    // The failed add persisted nothing.
    expect(persistedIds()).toEqual([before.id]);

    const after = await addProgressPhoto(pick("after"));

    expect(persistedIds()).toEqual([before.id, after.id].sort());
  });

  it("a failed delete write releases the lock and keeps record and file", async () => {
    const photo = await addProgressPhoto(pick("keepme"));

    storageMock.setStorage.mockRejectedValueOnce(new Error("disk full"));

    await expect(deleteProgressPhoto(photo.id)).rejects.toThrow("disk full");

    // Record and file both intact (the documented retryable state).
    expect(persistedIds()).toEqual([photo.id]);
    expect(fsMock.files.has(photo.uri)).toBe(true);

    // The lock is free: the retry works.
    await deleteProgressPhoto(photo.id);

    expect(persistedIds()).toEqual([]);
    expect(fsMock.files.has(photo.uri)).toBe(false);
  });

  it("the file copy is not held inside the lock", async () => {
    const slow = pick("slow");
    const fast = pick("fast");

    let release!: () => void;

    fsMock.copyGates.set(
      slow,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const slowAdd = addProgressPhoto(slow);
    const fastPhoto = await addProgressPhoto(fast);

    // The fast add finished and persisted while the slow copy is still
    // pending: the lock isn't held across the copy.
    expect(persistedIds()).toEqual([fastPhoto.id]);

    release();

    const slowPhoto = await slowAdd;

    expect(persistedIds()).toEqual([fastPhoto.id, slowPhoto.id].sort());
  });
});

describe("progress photo repository: existing behavior unchanged", () => {
  it("add copies the picked file and persists a record", async () => {
    const source = pick("one");

    const photo = await addProgressPhoto(source);

    expect(photo.uri).toBe(`file:///document/progress-photos/${photo.id}.jpg`);
    expect(photo.date).toBe(getTodayKey());
    expect(Number.isNaN(new Date(photo.timestamp).getTime())).toBe(false);

    // Created the directory and copied exactly once, from the picked file.
    expect(fsMock.dirs.has("file:///document/progress-photos")).toBe(true);
    expect(fsMock.copies).toEqual([{ from: source, to: photo.uri }]);
    expect(fsMock.files.has(photo.uri)).toBe(true);

    expect(await getProgressPhotos()).toEqual([photo]);
  });

  it("a missing source rejects with the same error and persists nothing", async () => {
    await expect(
      addProgressPhoto("file:///picker/missing.jpg"),
    ).rejects.toThrow("Picked photo could not be read");

    expect(persistedIds()).toEqual([]);
    expect(fsMock.copies).toEqual([]);
  });

  it("getProgressPhotos returns newest first", async () => {
    const first = await addProgressPhoto(pick("first"));

    await new Promise<void>((resolve) => setTimeout(resolve, 5));

    const second = await addProgressPhoto(pick("second"));

    expect((await getProgressPhotos()).map((p) => p.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("delete removes the record, then the file; unknown ids are a no-op", async () => {
    const keep = await addProgressPhoto(pick("keep"));
    const drop = await addProgressPhoto(pick("drop"));

    await deleteProgressPhoto(drop.id);

    expect(persistedIds()).toEqual([keep.id]);
    expect(fsMock.files.has(drop.uri)).toBe(false);
    expect(fsMock.files.has(keep.uri)).toBe(true);

    await expect(deleteProgressPhoto("nope")).resolves.toBeUndefined();

    expect(persistedIds()).toEqual([keep.id]);
  });
});
