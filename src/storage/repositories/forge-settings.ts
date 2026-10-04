import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/data/exercises";
import { buildCatalog } from "@/services/forge/catalog";
import { planFromRoutines } from "@/services/forge/plan";
import {
  DEFAULT_FORGE_SETTINGS,
  normalizeForgeSettings,
} from "@/services/forge/settings";
import { getRoutines } from "@/storage/repositories/routines";
import type { CustomExercise, ForgeSettings } from "@/types/forge";
import { createId } from "@/utils/id";

const SETTINGS_KEY = "@gymos/forge-settings";
const CUSTOM_KEY = "@gymos/custom-exercises";

const settingsMutex = createMutex();
const customMutex = createMutex();

async function readUnlocked(): Promise<ForgeSettings> {
  const stored = await getStorage<unknown>(SETTINGS_KEY);
  const settings =
    stored === null
      ? { ...DEFAULT_FORGE_SETTINGS }
      : normalizeForgeSettings(stored);

  if (settings.routinesImported) return settings;

  // First open after the switch: turn the old routines into a plan once.
  // The routines themselves are never modified.
  const routines = await getRoutines().catch(() => []);
  const custom = await readCustom();
  const plan = planFromRoutines(routines, buildCatalog(custom));
  const next: ForgeSettings = {
    ...settings,
    routinesImported: true,
    ...(plan && settings.plans.length === 0
      ? { plans: [plan], activePlanId: plan.id }
      : {}),
  };

  await setStorage(SETTINGS_KEY, next);

  return next;
}

export function getForgeSettings(): Promise<ForgeSettings> {
  return settingsMutex.runExclusive(readUnlocked);
}

/** Apply a change atomically (read → change → normalize → write). */
export function updateForgeSettings(
  change: (current: ForgeSettings) => ForgeSettings,
): Promise<ForgeSettings> {
  return settingsMutex.runExclusive(async () => {
    const next = normalizeForgeSettings(change(await readUnlocked()));

    await setStorage(SETTINGS_KEY, next);

    return next;
  });
}

async function readCustom(): Promise<CustomExercise[]> {
  const stored = await getStorage<unknown>(CUSTOM_KEY);

  if (!Array.isArray(stored)) return [];

  return stored.filter(
    (entry): entry is CustomExercise =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as CustomExercise).id === "string" &&
      typeof (entry as CustomExercise).name === "string" &&
      MUSCLE_GROUPS.includes((entry as CustomExercise).muscleGroup),
  );
}

export function getCustomExercises(): Promise<CustomExercise[]> {
  return customMutex.runExclusive(readCustom);
}

export function addCustomExercise(
  name: string,
  muscleGroup: MuscleGroup,
  bodyweight: boolean,
): Promise<CustomExercise | null> {
  const clean = name.trim();

  if (!clean) return Promise.resolve(null);

  return customMutex.runExclusive(async () => {
    const all = await readCustom();
    const existing = all.find(
      (entry) => entry.name.toLowerCase() === clean.toLowerCase(),
    );

    if (existing) return existing;

    const created: CustomExercise = {
      id: `custom-${createId()}`,
      name: clean,
      muscleGroup,
      bodyweight,
    };

    await setStorage(CUSTOM_KEY, [...all, created]);

    return created;
  });
}

export function deleteCustomExercise(id: string): Promise<void> {
  return customMutex.runExclusive(async () => {
    const all = await readCustom();

    await setStorage(
      CUSTOM_KEY,
      all.filter((entry) => entry.id !== id),
    );
  });
}
