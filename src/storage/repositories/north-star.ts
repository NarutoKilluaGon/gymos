import { getStorage, setStorage } from "@/storage/storage";
import type { NorthStar } from "@/types/gymos";

const NORTH_STAR_STORAGE_KEY = "@gymos/north-star";

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
  await setStorage(
    NORTH_STAR_STORAGE_KEY,
    northStar,
  );
}
