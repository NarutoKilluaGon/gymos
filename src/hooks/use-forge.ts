import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWeightUnit } from "@/hooks/use-weight-unit";
import { buildCatalog } from "@/services/forge/catalog";
import { detectPrs } from "@/services/forge/history";
import { toKg } from "@/services/forge/load";
import { startSession } from "@/services/forge/start";
import { activePlan } from "@/services/forge/settings";
import { finish, reopen } from "@/services/forge/timing";
import { weightPoints } from "@/services/nourish/weight";
import { getNourishSettings } from "@/storage/repositories/nourish-settings";
import {
  addCardioLog,
  getCardioMap,
  removeCardioLog,
} from "@/storage/repositories/nourish-cardio";
import {
  addCustomExercise,
  deleteCustomExercise,
  getCustomExercises,
  getForgeSettings,
  updateForgeSettings,
} from "@/storage/repositories/forge-settings";
import { getMeasurements } from "@/storage/repositories/measurements";
import {
  createSessionIfNoneActive,
  deleteSession,
  getActiveSession,
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type { MuscleGroup } from "@/data/exercises";
import type {
  CatalogExercise,
  CustomExercise,
  ForgeSettings,
} from "@/types/forge";
import type { CardioLog, CardioMap } from "@/types/nourish";
import type { WorkoutSession } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

export type ForgeData = {
  sessions: WorkoutSession[];
  settings: ForgeSettings;
  custom: CustomExercise[];
  catalog: CatalogExercise[];
  cardio: CardioMap;
  bodyweightKg: number | undefined;
};

/**
 * Everything the Workouts screens read, plus the writes that aren't about a
 * running session. Writes go to the repositories and then re-read, so the
 * screen always shows what is stored.
 */
export function useForge() {
  const { unit } = useWeightUnit();
  const [data, setData] = useState<ForgeData | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  // Reloads overlap (focus, every write's refresh, Start, close, finish), and
  // an older one can finish last holding an older snapshot. Only the reload
  // that is still the newest may commit; `alive` still covers unmount.
  const loadId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++loadId.current;

    try {
      const [sessions, settings, custom, cardio, measurements, nourish] =
        await Promise.all([
          getAllSessions(),
          getForgeSettings(),
          getCustomExercises(),
          getCardioMap(),
          getMeasurements("weight"),
          getNourishSettings().catch(() => null),
        ]);
      const weights = weightPoints(measurements);
      const latest = weights[weights.length - 1]?.kg;

      // Unmounted, or superseded by a newer reload: this snapshot is stale.
      if (!alive.current || id !== loadId.current) return;

      setData({
        sessions,
        settings,
        custom,
        catalog: buildCatalog(custom),
        cardio,
        bodyweightKg: latest ?? nourish?.fallbackWeightKg,
      });
    } catch {
      if (alive.current && id === loadId.current) showToast("Couldn't load workouts");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const act = useCallback(
    async (write: () => Promise<unknown>, failure: string) => {
      try {
        await write();
      } catch {
        showToast(failure);
        await reload().catch(() => undefined);

        return false;
      }

      await reload().catch(() => undefined);

      return true;
    },
    [reload],
  );

  const actions = useMemo(
    () => ({
      /** Create and persist a session from a plan day (or empty). */
      begin: async (input: {
        dayId?: string | null;
        date?: string;
        backdated?: boolean;
      }): Promise<WorkoutSession | null> => {
        if (!data) return null;

        // Build from what is stored now, not the copy this screen last
        // loaded: a plan edit still being saved (or made elsewhere) must be
        // what Start uses. The settings read queues behind any pending plan
        // write. Falls back to the loaded copy only if storage can't be read.
        const [settings, sessions] = await Promise.all([
          getForgeSettings().catch(() => data.settings),
          getAllSessions().catch(() => data.sessions),
        ]);
        const plan = activePlan(settings) ?? undefined;
        const day = input.dayId
          ? (plan?.days.find((entry) => entry.id === input.dayId) ?? null)
          : null;
        const session = startSession({
          day,
          ...(plan ? { plan } : {}),
          date: input.date ?? getTodayKey(),
          catalog: data.catalog,
          sessions,
          unit,
          ...(data.bodyweightKg ? { bodyweightKg: data.bodyweightKg } : {}),
          ...(input.backdated ? { backdated: true } : {}),
        });

        try {
          // Atomic: a second Start while one is running gets that session.
          const { session: saved } = await createSessionIfNoneActive(session);

          await reload();

          return saved;
        } catch {
          showToast("Couldn't start workout");

          return null;
        }
      },
      /**
       * Re-read one session from storage. Used when opening a workout so it
       * never starts from a stale in-memory copy (the list in `data` can lag
       * behind a save that was still in flight when it was loaded).
       */
      resume: async (id: string): Promise<WorkoutSession | null> => {
        try {
          const stored = await getAllSessions();

          return stored.find((session) => session.id === id) ?? null;
        } catch {
          showToast("Couldn't open workout");

          return null;
        }
      },
      remove: (id: string) =>
        act(() => deleteSession(id), "Couldn't delete workout"),
      saveSettings: (change: (current: ForgeSettings) => ForgeSettings) =>
        act(() => updateForgeSettings(change), "Couldn't save"),
      addCustom: async (
        name: string,
        muscle: MuscleGroup,
        bodyweight: boolean,
      ): Promise<CustomExercise | null> => {
        try {
          const created = await addCustomExercise(name, muscle, bodyweight);

          await reload();

          return created;
        } catch {
          showToast("Couldn't add exercise");

          return null;
        }
      },
      removeCustom: (id: string) =>
        act(() => deleteCustomExercise(id), "Couldn't delete"),
      addCardio: (
        dayKey: string,
        entry: Omit<CardioLog, "id" | "loggedAt">,
      ) => act(() => addCardioLog(dayKey, entry), "Couldn't save cardio"),
      removeCardio: (dayKey: string, id: string) =>
        act(() => removeCardioLog(dayKey, id), "Couldn't remove"),
    }),
    [act, data, reload, unit],
  );

  return {
    data,
    unit,
    reload,
    actions,
    weightKg: data?.bodyweightKg ?? 65,
    /** Display value → kg. */
    toKgInUnit: (value: number) => toKg(value, unit),
  };
}

/**
 * One running (or just-finished) session. Edits apply instantly on screen
 * and are persisted through a queue so two quick taps can never write out
 * of order; the last write always wins with the newest state.
 */
export function useLiveSession(
  initial: WorkoutSession,
  allSessions: readonly WorkoutSession[],
  unit: "kg" | "lb",
) {
  const [session, setSession] = useState(initial);
  const latest = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Queue a save of the newest state. The shared queue never rejects (so one
   * failed save can't block later ones, and `flush` stays safe to await), but
   * the returned promise settles with this write's own outcome so a caller
   * that must know whether it was stored (Complete) can see a failure.
   * `quiet` leaves the failure toast to that caller.
   */
  const persist = useCallback(
    (next: WorkoutSession, quiet = false): Promise<unknown> => {
      latest.current = next;

      const write = queue.current
        .catch(() => undefined)
        .then(() => saveSession(latest.current));

      queue.current = write.catch(() => {
        if (!quiet && alive.current) showToast("Couldn't save your last change");
      });

      return write;
    },
    [],
  );

  const update = useCallback(
    (change: (current: WorkoutSession) => WorkoutSession) => {
      const next = change(latest.current);

      if (next === latest.current) return;

      latest.current = next;
      setSession(next);
      // Failure is already toasted by the queue; nothing to handle here.
      persist(next).catch(() => undefined);
    },
    [persist],
  );

  /**
   * Finish: stamp the clock, detect PRs, save. The record book is re-derived
   * by the repository when the finished session is saved. Rejects if the
   * finished session could not be saved; the screen is then put back to the
   * unfinished session so it never looks completed when nothing was stored.
   */
  const complete = useCallback(
    async (now: Date = new Date()) => {
      // Judge against what is stored, not the list this screen last loaded;
      // fall back to that list only if storage can't be read. Read first so
      // an edit made while waiting is still part of the finished session.
      const history = await getAllSessions().catch(() => allSessions);
      const before = latest.current;
      const { session: closed, trimmed } = finish(before, now);
      const prs = detectPrs(history, closed, unit);
      const done: WorkoutSession = { ...closed, prs };

      latest.current = done;
      setSession(done);

      try {
        await persist(done, true);
      } catch (error) {
        // Roll back only if nothing newer was edited in the meantime.
        if (latest.current === done) {
          latest.current = before;

          if (alive.current) setSession(before);
        }

        if (alive.current) showToast("Couldn't save workout");

        throw error;
      }

      return { session: done, trimmed };
    },
    [allSessions, persist, unit],
  );

  /**
   * Reopen a finished session. At most one workout may be unfinished at a
   * time (Start enforces it with `createSessionIfNoneActive`), so reopening is
   * refused while a different one is running; the finished session is left
   * exactly as it was. Resolves true when the session was reopened.
   */
  const reopenSession = useCallback(
    async (now: Date = new Date()): Promise<boolean> => {
      let active: WorkoutSession | null;

      try {
        active = await getActiveSession();
      } catch {
        // Can't tell whether another workout is running, so don't risk two.
        if (alive.current) showToast("Couldn't reopen workout");

        return false;
      }

      // The screen was left while checking: don't reopen behind its back.
      if (!alive.current) return false;

      // The session being reopened may itself be the stored unfinished one
      // (e.g. its finish hasn't been written yet): that's not a conflict.
      if (active && active.id !== latest.current.id) {
        showToast("Finish or delete your current workout first");

        return false;
      }

      update((current) => (current.endedAt ? reopen(current, now) : current));

      return true;
    },
    [update],
  );

  /**
   * Resolves once every queued save has been written, including saves queued
   * while waiting. Call before leaving the session or reloading from storage
   * so a reload can never read data older than the latest edit. Never
   * rejects: a failed save already shows its own toast.
   */
  const flush = useCallback(async (): Promise<void> => {
    let tail: Promise<unknown>;

    // `persist` replaces the queue tail, so keep waiting until it stops moving.
    do {
      tail = queue.current;
      await tail;
    } while (tail !== queue.current);
  }, []);

  return { session, update, complete, reopenSession, flush };
}
