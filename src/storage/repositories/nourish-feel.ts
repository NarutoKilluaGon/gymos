import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { FeelMap, FeelValue } from "@/types/nourish";

const FEEL_KEY = "@gymos/nourish-feel";
const feelMutex = createMutex();

function isFeel(value: unknown): value is FeelValue {
  return value === 1 || value === 2 || value === 3;
}

/** Keep only well-formed ratings so a hand-edited record can't crash. */
function clean(raw: unknown): FeelMap {
  const out: FeelMap = {};

  if (typeof raw !== "object" || raw === null) return out;

  for (const [day, slots] of Object.entries(raw)) {
    if (typeof slots !== "object" || slots === null) continue;

    const dayFeel: FeelMap[string] = {};

    for (const [key, value] of Object.entries(slots as Record<string, unknown>)) {
      if (isFeel(value)) dayFeel[key] = value;
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
