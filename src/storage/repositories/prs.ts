import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import type { PersonalRecord } from "@/types/gymos";

const PRS_KEY = "@gymos/prs";

type PrMap = Record<string, PersonalRecord>;

export async function getPR(
  exerciseId: string,
): Promise<PersonalRecord | null> {
  const prs = (await getStorage<PrMap>(PRS_KEY)) ?? {};

  return prs[exerciseId] ?? null;
}

export async function getAllPRs(): Promise<PrMap> {
  return (await getStorage<PrMap>(PRS_KEY)) ?? {};
}

export async function setPR(
  record: PersonalRecord,
): Promise<void> {
  const prs = (await getStorage<PrMap>(PRS_KEY)) ?? {};

  prs[record.exerciseId] = record;

  await setStorage(PRS_KEY, prs);
}