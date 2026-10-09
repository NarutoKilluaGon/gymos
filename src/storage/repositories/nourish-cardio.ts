import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import type { CardioLog, CardioMap } from "@/types/nourish";
import { createId } from "@/utils/id";

const CARDIO_KEY = "@gymos/nourish-cardio";
const cardioMutex = createMutex();

function clean(raw: unknown): CardioMap {
  const out: CardioMap = {};

  if (typeof raw !== "object" || raw === null) return out;

  for (const [day, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;

    const valid = list.filter(
      (entry): entry is CardioLog =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as CardioLog).id === "string" &&
        typeof (entry as CardioLog).kcal === "number" &&
        Number.isFinite((entry as CardioLog).kcal),
    );

    if (valid.length > 0) out[day] = valid;
  }

  return out;
}

export async function getCardioMap(): Promise<CardioMap> {
  return cardioMutex.runExclusive(async () =>
    clean(await getStorage<unknown>(CARDIO_KEY)),
  );
}

export async function addCardioLog(
  dateKey: string,
  entry: Omit<CardioLog, "id" | "loggedAt">,
): Promise<CardioLog> {
  return cardioMutex.runExclusive(async () => {
    const map = clean(await getStorage<unknown>(CARDIO_KEY));
    const log: CardioLog = {
      ...entry,
      id: createId(),
      loggedAt: new Date().toISOString(),
    };

    map[dateKey] = [...(map[dateKey] ?? []), log];

    await setStorage(CARDIO_KEY, map);

    return log;
  });
}

export async function removeCardioLog(
  dateKey: string,
  id: string,
): Promise<void> {
  await cardioMutex.runExclusive(async () => {
    const map = clean(await getStorage<unknown>(CARDIO_KEY));
    const remaining = (map[dateKey] ?? []).filter((log) => log.id !== id);

    if (remaining.length === 0) delete map[dateKey];
    else map[dateKey] = remaining;

    await setStorage(CARDIO_KEY, map);
  });
}

export async function restoreCardioLog(
  dateKey: string,
  log: CardioLog,
  index?: number,
): Promise<void> {
  await cardioMutex.runExclusive(async () => {
    const map = clean(await getStorage<unknown>(CARDIO_KEY));
    const list = [...(map[dateKey] ?? [])];
    if (!list.some((l) => l.id === log.id)) {
      if (typeof index === "number" && index >= 0 && index <= list.length) {
        list.splice(index, 0, log);
      } else {
        list.push(log);
      }
      map[dateKey] = list;
      await setStorage(CARDIO_KEY, map);
    }
  });
}
