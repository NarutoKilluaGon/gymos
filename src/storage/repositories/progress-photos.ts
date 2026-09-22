import { Directory, File, Paths } from "expo-file-system";

import { getStorage, setStorage } from "@/storage/storage";
import type { ProgressPhoto } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

const PHOTOS_KEY = "@gymos/progress-photos";

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

  const current = await getProgressPhotos();

  await setStorage(PHOTOS_KEY, [...current, photo]);

  return photo;
}

export async function deleteProgressPhoto(
  id: string,
): Promise<void> {
  const current = await getProgressPhotos();

  const photo = current.find((item) => item.id === id);

  if (photo) {
    const file = new File(photo.uri);

    if (file.exists) {
      file.delete();
    }
  }

  await setStorage(
    PHOTOS_KEY,
    current.filter((item) => item.id !== id),
  );
}