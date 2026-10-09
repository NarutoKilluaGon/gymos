import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import type { ID, Timestamp } from "@/types/gymos";
import { createId } from "@/utils/id";

const SUPPLEMENTS_KEY = "@gymos/supplements";

export type Supplement = {
  id: ID;
  name: string;
  enabled: boolean;
  createdAt: Timestamp;
};

export async function getSupplements(): Promise<Supplement[]> {
  return (
    (await getStorage<Supplement[]>(SUPPLEMENTS_KEY)) ?? []
  );
}

export async function addSupplement(
  name: string,
): Promise<Supplement | null> {
  const trimmed = name.trim();

  if (!trimmed) {
    return null;
  }

  const supplements = await getSupplements();

  const existing = supplements.some(
    (s) =>
      s.name.toLowerCase() === trimmed.toLowerCase(),
  );

  if (existing) {
    return null;
  }

  const supplement: Supplement = {
    id: createId(),
    name: trimmed,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  supplements.push(supplement);

  await setStorage(SUPPLEMENTS_KEY, supplements);

  return supplement;
}

export async function removeSupplement(
  id: string,
): Promise<void> {
  const supplements = await getSupplements();

  await setStorage(
    SUPPLEMENTS_KEY,
    supplements.filter((s) => s.id !== id),
  );
}

export async function restoreSupplement(
  supplement: Supplement,
  index?: number,
): Promise<void> {
  const supplements = await getSupplements();
  if (!supplements.some((s) => s.id === supplement.id)) {
    if (typeof index === "number" && index >= 0 && index <= supplements.length) {
      supplements.splice(index, 0, supplement);
    } else {
      supplements.push(supplement);
    }
    await setStorage(SUPPLEMENTS_KEY, supplements);
  }
}

export async function setSupplementEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  const supplements = await getSupplements();

  await setStorage(
    SUPPLEMENTS_KEY,
    supplements.map((s) =>
      s.id === id ? { ...s, enabled } : s,
    ),
  );
}