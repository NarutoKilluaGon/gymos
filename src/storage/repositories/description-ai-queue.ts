import {
  getStorage,
  setStorage,
} from "@/storage/storage";
import { createMutex } from "@/storage/mutex";
import { createId } from "@/utils/id";

/** Public key for the durable, description-only AI retry queue. */
export const DESCRIPTION_AI_QUEUE_KEY =
  "@gymos/description-ai-queue";

/** A network failure remains automatically retryable. */
export type PendingDescriptionErrorCode =
  | "network"
  | "http"
  | "invalid-response";

export type PendingDescriptionStatus =
  | "pending"
  | "needs-attention";

/**
 * A queued description contains no nutrition at all. Nutrition is created
 * only after a successful retry, validated, and handed to MealSheet review.
 */
export type PendingDescriptionAnalysis = {
  id: string;
  description: string;
  createdAt: string;
  status: PendingDescriptionStatus;
  retryCount: number;
  lastAttemptAt?: string;
  lastErrorCode?: PendingDescriptionErrorCode;
};

const queueMutex = createMutex();

function descriptionKey(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function readQueueUnlocked(): Promise<
  PendingDescriptionAnalysis[]
> {
  const stored = await getStorage<
    PendingDescriptionAnalysis[]
  >(DESCRIPTION_AI_QUEUE_KEY);

  return Array.isArray(stored) ? stored : [];
}

async function writeQueueUnlocked(
  queue: PendingDescriptionAnalysis[],
): Promise<void> {
  await setStorage(DESCRIPTION_AI_QUEUE_KEY, queue);
}

function byCreatedAt(
  a: PendingDescriptionAnalysis,
  b: PendingDescriptionAnalysis,
): number {
  return a.createdAt.localeCompare(b.createdAt);
}

export async function getPendingDescriptionAnalyses(): Promise<
  PendingDescriptionAnalysis[]
> {
  return queueMutex.runExclusive(async () => {
    const queue = await readQueueUnlocked();
    return [...queue].sort(byCreatedAt);
  });
}

export async function getPendingDescriptionAnalysis(
  id: string,
): Promise<PendingDescriptionAnalysis | null> {
  const queue = await getPendingDescriptionAnalyses();
  return queue.find((item) => item.id === id) ?? null;
}

/**
 * Add a description once. The first original spelling is retained, while
 * duplicate detection ignores incidental whitespace/case so repeated taps
 * or reconnect passes cannot create parallel work.
 */
export async function enqueuePendingDescriptionAnalysis(
  description: string,
): Promise<PendingDescriptionAnalysis> {
  if (!description.trim()) {
    throw new Error("Description must not be empty");
  }

  return queueMutex.runExclusive(async () => {
    const queue = await readQueueUnlocked();
    const key = descriptionKey(description);
    const existing = queue.find(
      (item) => descriptionKey(item.description) === key,
    );

    if (existing) {
      return existing;
    }

    const item: PendingDescriptionAnalysis = {
      id: createId(),
      description,
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
    };

    await writeQueueUnlocked([...queue, item]);
    return item;
  });
}

/**
 * Record a failed attempt. Network failures stay automatically retryable;
 * HTTP and invalid-response failures move to needs-attention so an
 * automatic pass will not loop forever. The item itself is never removed.
 */
export async function recordPendingDescriptionFailure(
  id: string,
  errorCode: PendingDescriptionErrorCode,
): Promise<PendingDescriptionAnalysis | null> {
  return queueMutex.runExclusive(async () => {
    const queue = await readQueueUnlocked();
    const index = queue.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const current = queue[index];
    const next: PendingDescriptionAnalysis = {
      ...current,
      status:
        errorCode === "network" ? "pending" : "needs-attention",
      retryCount: current.retryCount + 1,
      lastAttemptAt: new Date().toISOString(),
      lastErrorCode: errorCode,
    };

    const updated = [...queue];
    updated[index] = next;
    await writeQueueUnlocked(updated);
    return next;
  });
}

/** Remove an item only after its estimate has reached the review flow. */
export async function removePendingDescriptionAnalysis(
  id: string,
): Promise<boolean> {
  return queueMutex.runExclusive(async () => {
    const queue = await readQueueUnlocked();
    const filtered = queue.filter((item) => item.id !== id);

    if (filtered.length === queue.length) {
      return false;
    }

    await writeQueueUnlocked(filtered);
    return true;
  });
}

/** Remove every queued description matching the normalized user text. */
export async function removePendingDescriptionAnalysesByDescription(
  description: string,
): Promise<number> {
  const key = descriptionKey(description);

  return queueMutex.runExclusive(async () => {
    const queue = await readQueueUnlocked();
    const kept = queue.filter(
      (item) => descriptionKey(item.description) !== key,
    );

    if (kept.length === queue.length) {
      return 0;
    }

    await writeQueueUnlocked(kept);
    return queue.length - kept.length;
  });
}

/** Test/support helper; production callers use item-specific removal. */
export async function clearPendingDescriptionAnalyses(): Promise<void> {
  await queueMutex.runExclusive(async () => {
    await writeQueueUnlocked([]);
  });
}
