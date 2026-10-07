import { createMutex } from "@/storage/mutex";
import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import type { PersonalRecord } from "@/types/gymos";

const PRS_KEY = "@gymos/prs";

type PrMap = Record<string, PersonalRecord>;

/** Serializes every write so two read -> modify -> write passes can't clash. */
const prMutex = createMutex();

export async function getPR(
  exerciseId: string,
): Promise<PersonalRecord | null> {
  const prs = (await getStorage<PrMap>(PRS_KEY)) ?? {};

  return prs[exerciseId] ?? null;
}

export async function getAllPRs(): Promise<PrMap> {
  return (await getStorage<PrMap>(PRS_KEY)) ?? {};
}

export function setPR(
  record: PersonalRecord,
): Promise<void> {
  return prMutex.runExclusive(async () => {
    const prs = (await getStorage<PrMap>(PRS_KEY)) ?? {};

    prs[record.exerciseId] = record;

    await setStorage(PRS_KEY, prs);
  });
}

export function clearPR(
  exerciseId: string,
): Promise<void> {
  return prMutex.runExclusive(async () => {
    const prs = (await getStorage<PrMap>(PRS_KEY)) ?? {};

    if (!(exerciseId in prs)) {
      return;
    }

    delete prs[exerciseId];

    await setStorage(PRS_KEY, prs);
  });
}

/**
 * Replace the whole record book. Used when records are re-derived from
 * workout history, so exercises that no longer have a record are dropped.
 */
export function replaceAllPRs(
  records: PrMap,
): Promise<void> {
  return prMutex.runExclusive(() => setStorage(PRS_KEY, records));
}
