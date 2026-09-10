import { NORTH_STAR_STORAGE_KEY } from "@/storage/constants";
import { appendEvent } from "@/storage/events";
import { getStorage, setStorage } from "@/storage/storage";
import type { NorthStar } from "@/types/gymos";

const DEFAULT_NORTH_STAR: NorthStar = {
  title: "18 inch biceps",
  why: "Build the physique I want.",
  lastChangedAt: new Date().toISOString(),
};

export async function getNorthStar(): Promise<NorthStar> {
  const stored =
    await getStorage<NorthStar>(
      NORTH_STAR_STORAGE_KEY,
    );

  return stored ?? DEFAULT_NORTH_STAR;
}

export async function saveNorthStar(
  northStar: NorthStar,
): Promise<void> {
  const previous = await getNorthStar();

  await setStorage(
    NORTH_STAR_STORAGE_KEY,
    northStar,
  );

  await appendEvent("northstar.changed", {
    previousTitle: previous.title,
    newTitle: northStar.title,
  });
}
