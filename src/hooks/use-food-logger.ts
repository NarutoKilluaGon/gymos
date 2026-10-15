import { useCallback, useState } from "react";

import {
  getDescriptionAiProvider,
  isProxyCold,
} from "@/services/meal-description-ai-provider";
import { splitDescriptionSegments } from "@/services/meal-description-parsing";
import { looksLikeCardio } from "@/services/nourish/cardio";
import {
  resolveStage1,
  resolveSingleSegment,
  resolveStaged,
} from "@/services/nourish/resolve-log";
import { pickSlot, slotFromText } from "@/services/nourish/slots";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import type { MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

export type StagedSegment = {
  id: string;
  segment: string;
  status: "matched" | "estimating" | "estimated" | "failed";
  item?: DraftItem;
  error?: string;
};

export type ReviewState = {
  items: DraftItem[];
  stagedSegments?: StagedSegment[];
  estimating?: boolean;
  estimatingProgress?: { current: number; total: number };
  isColdStart?: boolean;
  notice?: string;
  slot: MealSlot;
  /** "HH:MM" eaten, or "" for no clock time. */
  at: string;
  /** The day this entry was opened for. Snapshotted so confirming after
   *  midnight does not move it onto the new day. */
  dayKey: string;
};

export type ManualState = {
  name: string;
  slot?: MealSlot;
  /** Day and "HH:MM" ("" for none) snapshotted when the sheet opened. */
  dayKey: string;
  at: string;
};

/** The date/time context captured when an entry is started. */
type DayContext = { dayKey: string; at: string };

export function clock(now: Date): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Valid "HH:MM", else null. */
export function parseClock(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours < 24 && minutes < 60
    ? `${String(hours).padStart(2, "0")}:${match[2]}`
    : null;
}

/**
 * State machine behind "log anything": type a sentence → resolve it →
 * review → save. Used by the Today dock and the global quick-add sheet so
 * both behave identically.
 */
export function useFoodLogger(input: {
  dayKey: string;
  /** Resolves the day to log to from the live clock at the moment an entry
   *  is started (not from render state). Defaults to `dayKey`. */
  resolveDay?: () => string;
  saved: readonly SavedFood[];
  /** Sections that already have entries on the viewed day. */
  filled: ReadonlySet<MealSlot>;
  save: (args: {
    items: readonly DraftItem[];
    slot: MealSlot;
    at: string | null;
    dayKey: string;
  }) => Promise<boolean>;
  /** Called when the text describes exercise instead of food. */
  onCardioText?: (text: string) => void;
  onLogged?: () => void;
}) {
  const { dayKey, resolveDay, saved, filled, save, onCardioText, onLogged } =
    input;
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [eatingOut, setEatingOut] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [manual, setManual] = useState<ManualState | null>(null);

  /** The day to log to and, for today only, the current clock time. */
  const snapshot = useCallback((): DayContext => {
    const day = resolveDay ? resolveDay() : dayKey;

    return { dayKey: day, at: day === getTodayKey() ? clock(new Date()) : "" };
  }, [dayKey, resolveDay]);

  const openReview = useCallback(
    (
      items: DraftItem[],
      options?: {
        notice?: string;
        named?: MealSlot | null;
        context?: DayContext;
      },
    ) => {
      const { dayKey: day, at } = options?.context ?? snapshot();

      setReview({
        items,
        ...(options?.notice ? { notice: options.notice } : {}),
        at,
        dayKey: day,
        slot: pickSlot({
          named: options?.named ?? null,
          at: at || null,
          filled,
        }),
      });
    },
    [filled, snapshot],
  );

  /** Returns true when the text was handled (so the caller can clear it). */
  const submit = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed || busy) return false;

      if (looksLikeCardio(trimmed) && onCardioText) {
        onCardioText(trimmed);
        return true;
      }

      const rawSegments = splitDescriptionSegments(trimmed);
      if (rawSegments.length === 0) return false;

      const context = snapshot();
      const slot = pickSlot({
        named: slotFromText(trimmed),
        at: context.at || null,
        filled,
      });

      // Step 1: Instant local resolution (≤ 50ms)
      const { resolutions, unknownSegments } = await resolveStage1(rawSegments, saved);

      const staged: StagedSegment[] = resolutions.map((res, i) => {
        if (res.status === "matched" && res.item) {
          return {
            id: `seg-${i}-${Date.now()}`,
            segment: res.segment,
            status: "matched" as const,
            item: res.item,
          };
        }
        return {
          id: `seg-${i}-${Date.now()}`,
          segment: res.segment,
          status: "estimating" as const,
        };
      });

      const provider = getDescriptionAiProvider();
      const cold = isProxyCold();

      if (!provider || unknownSegments.length === 0) {
        const matchedItems = staged.map((s) => s.item).filter(Boolean) as DraftItem[];
        if (matchedItems.length === 0) {
          showToast("Offline and not a food I know. Add it manually.");
          setManual({ name: trimmed, ...context });
          return true;
        }
        setReview({
          items: matchedItems,
          stagedSegments: staged,
          estimating: false,
          slot,
          at: context.at,
          dayKey: context.dayKey,
        });
        return true;
      }

      // Step 2: Open "Check before saving" sheet IMMEDIATELY with live progress!
      setReview({
        items: staged.map((s) => s.item).filter(Boolean) as DraftItem[],
        stagedSegments: staged,
        estimating: true,
        estimatingProgress: { current: 1, total: unknownSegments.length },
        isColdStart: cold,
        slot,
        at: context.at,
        dayKey: context.dayKey,
      });

      // Background Stage 2: Parallel proxy requests (max 3 concurrent, deduped)
      (async () => {
        let completedCount = 0;
        const CONCURRENCY = 3;

        const uniqueMap = new Map<string, { segment: string; indices: number[] }>();
        for (const { segment, index } of unknownSegments) {
          const key = segment.toLowerCase().trim();
          const existing = uniqueMap.get(key);
          if (existing) {
            existing.indices.push(index);
          } else {
            uniqueMap.set(key, { segment, indices: [index] });
          }
        }

        const queue = Array.from(uniqueMap.values());

        for (let i = 0; i < queue.length; i += CONCURRENCY) {
          const chunk = queue.slice(i, i + CONCURRENCY);
          await Promise.all(
            chunk.map(async ({ segment, indices }) => {
              const item = await resolveSingleSegment(segment, provider);
              completedCount += indices.length;

              setReview((prev) => {
                if (!prev || !prev.stagedSegments) return prev;
                const nextStaged = [...prev.stagedSegments];
                for (const idx of indices) {
                  if (item) {
                    nextStaged[idx] = {
                      ...nextStaged[idx]!,
                      status: "estimated",
                      item: { ...item },
                      error: undefined,
                    };
                  } else {
                    nextStaged[idx] = {
                      ...nextStaged[idx]!,
                      status: "failed",
                      error: "Couldn't estimate.",
                      item: undefined,
                    };
                  }
                }
                const stillEstimating = nextStaged.some((s) => s.status === "estimating");
                const currentItems = nextStaged.map((s) => s.item).filter(Boolean) as DraftItem[];
                return {
                  ...prev,
                  items: currentItems,
                  stagedSegments: nextStaged,
                  estimating: stillEstimating,
                  estimatingProgress: {
                    current: Math.min(completedCount + 1, unknownSegments.length),
                    total: unknownSegments.length,
                  },
                  isColdStart: false,
                };
              });
            }),
          );
        }
      })();

      return true;
    },
    [busy, filled, onCardioText, saved, snapshot],
  );

  const retrySegment = useCallback(
    async (segmentId: string) => {
      const provider = getDescriptionAiProvider();
      if (!provider) return;

      let targetSeg: StagedSegment | undefined;
      setReview((prev) => {
        if (!prev || !prev.stagedSegments) return prev;
        const next = prev.stagedSegments.map((s) => {
          if (s.id === segmentId) {
            targetSeg = s;
            return { ...s, status: "estimating" as const, error: undefined };
          }
          return s;
        });
        return {
          ...prev,
          stagedSegments: next,
          estimating: true,
        };
      });

      if (!targetSeg) return;

      const item = await resolveSingleSegment(targetSeg.segment, provider, true);

      setReview((prev) => {
        if (!prev || !prev.stagedSegments) return prev;
        const next = prev.stagedSegments.map((s) => {
          if (s.id === segmentId) {
            if (item) {
              return { ...s, status: "estimated" as const, item: { ...item }, error: undefined };
            }
            return { ...s, status: "failed" as const, error: "Couldn't estimate.", item: undefined };
          }
          return s;
        });
        const stillEstimating = next.some((s) => s.status === "estimating");
        const nextItems = next.map((s) => s.item).filter(Boolean) as DraftItem[];
        return {
          ...prev,
          items: nextItems,
          stagedSegments: next,
          estimating: stillEstimating,
        };
      });
    },
    [],
  );

  const updateStagedItem = useCallback(
    (segmentId: string, updated: DraftItem) => {
      setReview((prev) => {
        if (!prev || !prev.stagedSegments) return prev;
        const nextStaged = prev.stagedSegments.map((s) =>
          s.id === segmentId ? { ...s, item: updated } : s,
        );
        const nextItems = nextStaged.map((s) => s.item).filter(Boolean) as DraftItem[];
        return { ...prev, stagedSegments: nextStaged, items: nextItems };
      });
    },
    [],
  );

  const removeStagedSegment = useCallback(
    (segmentId: string) => {
      setReview((prev) => {
        if (!prev || !prev.stagedSegments) return prev;
        const nextStaged = prev.stagedSegments.filter((s) => s.id !== segmentId);
        const nextItems = nextStaged.map((s) => s.item).filter(Boolean) as DraftItem[];
        return { ...prev, stagedSegments: nextStaged, items: nextItems };
      });
    },
    [],
  );

  const openManual = useCallback(
    (nameOrSlot: string = "", optionalSlot?: MealSlot) => {
      let name = nameOrSlot;
      let slot: MealSlot | undefined = optionalSlot;
      if (!optionalSlot && (["Breakfast", "Lunch", "Snacks", "Dinner"] as const).includes(nameOrSlot as MealSlot)) {
        slot = nameOrSlot as MealSlot;
        name = "";
      }
      setManual({ name, slot, ...snapshot() });
    },
    [snapshot],
  );

  const confirm = useCallback(async () => {
    if (!review || busy || review.estimating) return;

    const items = review.items.filter((item) => item.multiplier > 0);

    if (items.length === 0) {
      setReview(null);

      return;
    }

    setBusy(true);

    const ok = await save({
      items,
      slot: review.slot,
      at: parseClock(review.at),
      dayKey: review.dayKey,
    });

    setBusy(false);

    if (ok) {
      setReview(null);
      onLogged?.();
    }
  }, [busy, onLogged, review, save]);

  const saveManual = useCallback(
    async (item: DraftItem, slot: MealSlot, at?: string) => {
      // The sheet's own snapshot; falls back to now only if it was closed.
      const context = manual ?? snapshot();
      const resolvedAt = at !== undefined ? parseClock(at) : parseClock(context.at);

      setBusy(true);

      const ok = await save({
        items: [item],
        slot,
        at: resolvedAt,
        dayKey: context.dayKey,
      });

      setBusy(false);

      if (ok) {
        setManual(null);
        onLogged?.();
      }
    },
    [manual, onLogged, save, snapshot],
  );

  return {
    busy,
    busyMessage,
    eatingOut,
    setEatingOut,
    review,
    setReview,
    manual,
    setManual,
    submit,
    confirm,
    saveManual,
    openReview,
    openManual,
    retrySegment,
    updateStagedItem,
    removeStagedSegment,
  };
}

export type FoodLogger = ReturnType<typeof useFoodLogger>;
