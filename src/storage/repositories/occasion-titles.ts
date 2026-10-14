import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";

const OCCASION_TITLES_KEY = "@gymos/nourish-occasion-titles";
const titlesMutex = createMutex();

/** Keyed by occasion id (e.g., `occasion-${firstMeal.id}-${count}` or first meal id). */
export type OccasionTitlesMap = Record<string, string>;

function clean(raw: unknown): OccasionTitlesMap {
  const out: OccasionTitlesMap = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

export async function getOccasionTitles(): Promise<OccasionTitlesMap> {
  return titlesMutex.runExclusive(async () =>
    clean(await getStorage<unknown>(OCCASION_TITLES_KEY)),
  );
}

export async function setOccasionTitle(
  occasionId: string,
  title: string,
): Promise<void> {
  await titlesMutex.runExclusive(async () => {
    const map = clean(await getStorage<unknown>(OCCASION_TITLES_KEY));
    const trimmed = title.trim();
    if (!trimmed) {
      delete map[occasionId];
    } else {
      map[occasionId] = trimmed;
    }
    await setStorage(OCCASION_TITLES_KEY, map);
  });
}
