import { Directory, File, Paths } from "expo-file-system";

import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { ProgressPhoto } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

const PHOTOS_KEY = "@gymos/progress-photos";

/** Serializes every read -> modify -> write of PHOTOS_KEY so overlapping
 *  add/delete calls can't each persist a stale snapshot (lost update or
 *  resurrected record). getProgressPhotos() is a plain read and does not
 *  take this lock, so it is safe to call from inside a task. */
const photosMutex = createMutex();

function photosDirectory(): Directory {
  return new Directory(Paths.document, "progress-photos");
}

export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  const photos =
    (await getStorage<ProgressPhoto[]>(PHOTOS_KEY)) ?? [];

  return [...photos].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime(),
  );
}

export async function addProgressPhoto(
  sourceUri: string,
): Promise<ProgressPhoto> {
  const dir = photosDirectory();

  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const id = createId();
  const destination = new File(dir, `${id}.jpg`);

  const source = new File(sourceUri);

  if (!source.exists) {
    throw new Error("Picked photo could not be read");
  }

  await source.copy(destination);

  const photo: ProgressPhoto = {
    id,
    uri: destination.uri,
    date: getTodayKey(),
    timestamp: new Date().toISOString(),
  };

  // The copy above stays outside the lock (it is slow and doesn't touch
  // the list); only the record read-modify-write is serialized.
  await photosMutex.runExclusive(async () => {
    const current = await getProgressPhotos();

    await setStorage(PHOTOS_KEY, [...current, photo]);
  });

  return photo;
}

export async function deleteProgressPhoto(
  id: string,
): Promise<void> {
  // The whole record mutation is one serialized transaction. The file is
  // deleted after the lock is released: it needs no serialization.
  const photo = await photosMutex.runExclusive(async () => {
    const current = await getProgressPhotos();

    const found = current.find((item) => item.id === id);

    // Commit the metadata removal before touching the file: the record is
    // the source of truth, so a failed write must leave record and file
    // both intact (retryable) — never a record pointing at a deleted file.
    await setStorage(
      PHOTOS_KEY,
      current.filter((item) => item.id !== id),
    );

    return found;
  });

  if (photo) {
    const file = new File(photo.uri);

    try {
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      // Best-effort cleanup: the record is already gone, so a leftover
      // file is an orphan no view or export can reach (exports iterate
      // records, not the directory). Failing here would report an error
      // for a delete that already succeeded.
      console.error(
        "Couldn't delete progress photo file",
        error,
      );
    }
  }
}