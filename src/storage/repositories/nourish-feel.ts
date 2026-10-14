import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { FeelMap, FeelValue } from "@/types/nourish";

const FEEL_KEY = "@gymos/nourish-feel";
const feelMutex = createMutex();

function isFeel(value: unknown): value is FeelValue {
  return value === 1 || value === 2 || value === 3;
}

export const MAX_FEEL_KEYS_PER_DAY = 20;

/** Keep only well-formed ratings and cap per day so it cannot grow unbounded. */
export function clean(
  raw: unknown,
  validMealIdsForDay?: (day: string) => Set<string>,
): FeelMap {
  const out: FeelMap = {};

  if (typeof raw !== "object" || raw === null) return out;

  for (const [day, slots] of Object.entries(raw)) {
    if (typeof slots !== "object" || slots === null) continue;

    const dayFeel: FeelMap[string] = {};
    const validMealIds = validMealIdsForDay?.(day);
    let count = 0;

    for (const [key, value] of Object.entries(slots as Record<string, unknown>)) {
      if (!isFeel(value)) continue;

      // Prune stale occasion keys if valid meal IDs are provided
      if (validMealIds && key.startsWith("occasion-")) {
        const mealId = key.replace("occasion-", "");
        if (!validMealIds.has(mealId)) continue;
      }

      dayFeel[key] = value;
      count++;
      if (count >= MAX_FEEL_KEYS_PER_DAY) break;
    }

    if (Object.keys(dayFeel).length > 0) out[day] = dayFeel;
  }

  return out;
}

export async function getFeelMap(): Promise<FeelMap> {
  return feelMutex.runExclusive(async () =>
    clean(await getStorage<unknown>(FEEL_KEY)),
  );
}

/** Set how an occasion or meal felt; choosing the current value again clears it. */
export async function toggleFeel(
  dateKey: string,
  key: string,
  value: FeelValue,
): Promise<void> {
  await feelMutex.runExclusive(async () => {
    const map = clean(await getStorage<unknown>(FEEL_KEY));
    const day = { ...(map[dateKey] ?? {}) };

    if (day[key] === value) delete day[key];
    else day[key] = value;

    if (Object.keys(day).length === 0) delete map[dateKey];
    else map[dateKey] = day;

    await setStorage(FEEL_KEY, map);
  });
}
