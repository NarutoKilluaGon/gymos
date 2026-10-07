import AsyncStorage from "@react-native-async-storage/async-storage";

import { importFromUri } from "@/services/import";
import {
  addProgressPhoto,
  getProgressPhotos,
} from "@/storage/repositories/progress-photos";

const PHOTOS_KEY = "@gymos/progress-photos";
const PHOTO_DIR = "file:///document/progress-photos";
const BACKUP_URI = "file:///backup/gymos.json";

jest.mock("expo-file-system", () => {
  // Minimal in-memory file system: just what progress-photos.ts and
  // import.ts touch. Contents are kept so restores can be checked.
  const fs = {
    files: new Map<string, string>(),
    dirs: new Set<string>(),
    failWrite: new Set<string>(),
    failDelete: false,
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

    create(options?: { overwrite?: boolean }) {
      if (fs.files.has(this.uri) && !options?.overwrite) {
        throw new Error("file exists");
      }

      fs.files.set(this.uri, "");
    }

    write(content: string) {
      if (fs.failWrite.has(this.uri)) throw new Error("write failed");

      fs.files.set(this.uri, content);
    }

    async text() {
      return fs.files.get(this.uri) ?? "";
    }

    async copy(destination: { uri: string }) {
      fs.files.set(destination.uri, fs.files.get(this.uri) ?? "");
    }

    delete() {
      if (fs.failDelete) throw new Error("delete failed");

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
  const state = { store: {} as Record<string, string> };

  const getStorage = jest.fn(async (key: string): Promise<unknown> => {
    const raw = state.store[key];

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
      getStorage.mockReset();
      getStorage.mockImplementation(async (key: string) => {
        const raw = state.store[key];

        return raw === undefined ? null : JSON.parse(raw);
      });
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
      files: Map<string, string>;
      dirs: Set<string>;
      failWrite: Set<string>;
      failDelete: boolean;
    };
  }
).__fs;

const storageMock = jest.requireMock("@/storage/storage") as {
  __state: { store: Record<string, string> };
  __reset(): void;
  getStorage: jest.Mock;
  setStorage: jest.Mock;
};

const P1 = "1700000000001-aaa";
const P2 = "1700000000002-bbb";
const P3 = "1700000000003-ccc";

const photoPath = (id: string) => `${PHOTO_DIR}/${id}.jpg`;

const record = (id: string) => ({
  id,
  uri: `file:///origin-device/${id}.jpg`,
  date: "2026-10-01",
  timestamp: "2026-10-01T00:00:00.000Z",
});

/** Files under the photos directory (what a leak would leave behind). */
function photoFiles(): string[] {
  return [...fsMock.files.keys()].filter((uri) => uri.startsWith(PHOTO_DIR));
}

/** Put a backup bundle in the in-memory file system and return its URI. */
function writeBackup(
  photos: unknown[],
  files: Record<string, string>,
): string {
  fsMock.files.set(
    BACKUP_URI,
    JSON.stringify({
      app: "gymos",
      format: 1,
      version: "1.0.0",
      exportedAt: "2026-10-05T00:00:00.000Z",
      data: { [PHOTOS_KEY]: photos },
      files,
    }),
  );

  return BACKUP_URI;
}

/** Register a picked source photo and return its URI. */
function pick(name: string): string {
  const uri = `file:///picker/${name}.jpg`;

  fsMock.files.set(uri, "PICKED-BYTES");

  return uri;
}

let multiSetSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  storageMock.__reset();
  fsMock.files.clear();
  fsMock.dirs.clear();
  fsMock.failWrite.clear();
  fsMock.failDelete = false;

  await AsyncStorage.clear();

  // Call-through spy: real in-memory multiSet unless a test rejects it once.
  // Cleared (never restored) so the shared AsyncStorage mock keeps working.
  multiSetSpy = jest.spyOn(AsyncStorage, "multiSet");
  multiSetSpy.mockClear();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("addProgressPhoto: orphan cleanup after the copy", () => {
  it("a record write failure removes the copied file and rethrows", async () => {
    const source = pick("one");

    storageMock.setStorage.mockRejectedValueOnce(new Error("disk full"));

    await expect(addProgressPhoto(source)).rejects.toThrow("disk full");

    expect(photoFiles()).toEqual([]);
    // The picked source is never touched.
    expect(fsMock.files.get(source)).toBe("PICKED-BYTES");
    expect(storageMock.__state.store[PHOTOS_KEY]).toBeUndefined();
  });

  it("a record read failure removes the copied file and rethrows", async () => {
    const source = pick("one");

    storageMock.getStorage.mockRejectedValueOnce(new Error("read failed"));

    await expect(addProgressPhoto(source)).rejects.toThrow("read failed");

    expect(photoFiles()).toEqual([]);
    expect(storageMock.setStorage).not.toHaveBeenCalled();
  });

  it("a cleanup failure does not mask the original error", async () => {
    const source = pick("one");
    const original = new Error("disk full");

    storageMock.setStorage.mockRejectedValueOnce(original);
    fsMock.failDelete = true;

    // The very same error object comes back, not the delete failure.
    await expect(addProgressPhoto(source)).rejects.toBe(original);
    expect(errorSpy).toHaveBeenCalled();

    // The mutex is still free: a later add works once deletes work again.
    fsMock.failDelete = false;

    const later = await addProgressPhoto(pick("two"));

    expect((await getProgressPhotos()).map((p) => p.id)).toEqual([later.id]);
  });

  it("a successful add keeps its file", async () => {
    const photo = await addProgressPhoto(pick("one"));

    expect(photoFiles()).toEqual([photo.uri]);
    expect(fsMock.files.get(photo.uri)).toBe("PICKED-BYTES");
    expect((await getProgressPhotos()).map((p) => p.id)).toEqual([photo.id]);
  });
});

describe("importFromUri: rollback of newly created photo files", () => {
  it("a multiSet failure removes the files this import created", async () => {
    const uri = writeBackup([record(P1), record(P2)], {
      [P1]: "BYTES-1",
      [P2]: "BYTES-2",
    });

    multiSetSpy.mockRejectedValueOnce(new Error("quota"));

    await expect(importFromUri(uri)).rejects.toThrow(
      "Couldn't save imported data",
    );

    expect(photoFiles()).toEqual([]);
    expect(await AsyncStorage.getItem(PHOTOS_KEY)).toBeNull();
  });

  it("a mid-materialization failure removes earlier newly created files", async () => {
    const uri = writeBackup([record(P1), record(P2), record(P3)], {
      [P1]: "BYTES-1",
      [P2]: "BYTES-2",
      [P3]: "BYTES-3",
    });

    fsMock.failWrite.add(photoPath(P2));

    await expect(importFromUri(uri)).rejects.toThrow(
      "Couldn't save imported photos",
    );

    // P1 (written) and P2 (created, write failed) are both gone; P3 was
    // never reached.
    expect(photoFiles()).toEqual([]);
    // Storage was never touched.
    expect(multiSetSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(PHOTOS_KEY)).toBeNull();
  });

  it("a pre-existing same-ID file survives a multiSet rollback", async () => {
    // P1 already exists on this device (a local record may reference it).
    fsMock.files.set(photoPath(P1), "LOCAL-BYTES");

    const uri = writeBackup([record(P1), record(P2)], {
      [P1]: "BYTES-1",
      [P2]: "BYTES-2",
    });

    multiSetSpy.mockRejectedValueOnce(new Error("quota"));

    await expect(importFromUri(uri)).rejects.toThrow(
      "Couldn't save imported data",
    );

    // Only the file this import created was removed.
    expect(fsMock.files.has(photoPath(P1))).toBe(true);
    expect(fsMock.files.has(photoPath(P2))).toBe(false);
  });

  it("a pre-existing same-ID file survives a mid-materialization rollback", async () => {
    fsMock.files.set(photoPath(P1), "LOCAL-BYTES");

    const uri = writeBackup([record(P1), record(P2), record(P3)], {
      [P1]: "BYTES-1",
      [P2]: "BYTES-2",
      [P3]: "BYTES-3",
    });

    fsMock.failWrite.add(photoPath(P3));

    await expect(importFromUri(uri)).rejects.toThrow(
      "Couldn't save imported photos",
    );

    expect(fsMock.files.has(photoPath(P1))).toBe(true);
    expect(fsMock.files.has(photoPath(P2))).toBe(false);
    expect(fsMock.files.has(photoPath(P3))).toBe(false);
  });

  it("a cleanup failure does not mask the import error", async () => {
    const uri = writeBackup([record(P1)], { [P1]: "BYTES-1" });

    multiSetSpy.mockRejectedValueOnce(new Error("quota"));
    fsMock.failDelete = true;

    await expect(importFromUri(uri)).rejects.toThrow(
      "Couldn't save imported data",
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it("a successful import leaves the files and rewrites the record uris", async () => {
    const uri = writeBackup([record(P1), record(P2)], {
      [P1]: "BYTES-1",
      [P2]: "BYTES-2",
    });

    await expect(importFromUri(uri)).resolves.toBe(1);

    expect(photoFiles().sort()).toEqual([photoPath(P1), photoPath(P2)]);
    expect(fsMock.files.get(photoPath(P1))).toBe("BYTES-1");
    expect(fsMock.files.get(photoPath(P2))).toBe("BYTES-2");

    const stored = JSON.parse(
      (await AsyncStorage.getItem(PHOTOS_KEY)) as string,
    ) as { id: string; uri: string }[];

    expect(stored.map((p) => p.uri)).toEqual([
      photoPath(P1),
      photoPath(P2),
    ]);
  });

  it("invalid photo IDs create nothing", async () => {
    const badIds = ["../evil", "a/b", "", "1700000000009-UPPER", 42, null];
    const photos = [
      ...badIds.map((id) => ({ ...record(P1), id })),
      // A valid ID with no bundled bytes also creates nothing.
      record(P3),
    ];
    const files: Record<string, string> = {};

    for (const id of badIds) {
      if (typeof id === "string") files[id] = "EVIL";
    }

    const uri = writeBackup(photos, files);
    const before = [...fsMock.files.keys()];

    await expect(importFromUri(uri)).resolves.toBe(1);

    // No new file anywhere: not in the photos directory, not outside it.
    expect([...fsMock.files.keys()]).toEqual(before);
    expect(photoFiles()).toEqual([]);
  });
});
