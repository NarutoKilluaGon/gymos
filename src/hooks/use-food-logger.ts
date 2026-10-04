import { useCallback, useState } from "react";

import { looksLikeCardio } from "@/services/nourish/cardio";
import { resolveLogText } from "@/services/nourish/resolve-log";
import { pickSlot, slotFromText } from "@/services/nourish/slots";
import type { SavedFood } from "@/storage/repositories/saved-foods";
import type { MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

export type ReviewState = {
  items: DraftItem[];
  notice?: string;
  slot: MealSlot;
  /** "HH:MM" eaten, or "" for no clock time. */
  at: string;
};

export type ManualState = { name: string };

function clock(now: Date): string {
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
  const { dayKey, saved, filled, save, onCardioText, onLogged } = input;
  const [busy, setBusy] = useState(false);
  const [eatingOut, setEatingOut] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [manual, setManual] = useState<ManualState | null>(null);

  const defaultAt = useCallback(
    () => (dayKey === getTodayKey() ? clock(new Date()) : ""),
    [dayKey],
  );

  const openReview = useCallback(
    (items: DraftItem[], options?: { notice?: string; named?: MealSlot | null }) => {
      const at = defaultAt();

      setReview({
        items,
        ...(options?.notice ? { notice: options.notice } : {}),
        at,
        slot: pickSlot({
          named: options?.named ?? null,
          at: at || null,
          filled,
        }),
      });
    },
    [defaultAt, filled],
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

      setBusy(true);

      try {
        const outcome = await resolveLogText(trimmed, { saved, eatingOut });

        if (outcome.status === "empty") return false;

        if (outcome.status === "manual") {
          showToast(
            outcome.reason === "unreadable"
              ? "Couldn't read that. Add it manually."
              : "Offline and not a food I know. Add it manually.",
          );
          setManual({ name: outcome.name });

          return true;
        }

        openReview(outcome.items, {
          ...(outcome.notice ? { notice: outcome.notice } : {}),
          named: slotFromText(trimmed),
        });

        return true;
      } catch {
        showToast("Couldn't analyze that. Add it manually.");
        setManual({ name: trimmed });

        return true;
      } finally {
        setBusy(false);
      }
    },
    [busy, eatingOut, onCardioText, openReview, saved],
  );

  const openManual = useCallback(
    (name = "") => setManual({ name }),
    [],
  );

  const confirm = useCallback(async () => {
    if (!review || busy) return;

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
      dayKey,
    });

    setBusy(false);

    if (ok) {
      setReview(null);
      onLogged?.();
    }
  }, [busy, dayKey, onLogged, review, save]);

  const saveManual = useCallback(
    async (item: DraftItem, slot: MealSlot) => {
      setBusy(true);

      const ok = await save({
        items: [item],
        slot,
        at: parseClock(defaultAt()),
        dayKey,
      });

      setBusy(false);

      if (ok) {
        setManual(null);
        onLogged?.();
      }
    },
    [dayKey, defaultAt, onLogged, save],
  );

  return {
    busy,
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
  };
}

export type FoodLogger = ReturnType<typeof useFoodLogger>;
