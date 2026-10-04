import { createMutex } from "@/storage/mutex";
import { getStorage, setStorage } from "@/storage/storage";
import {
  normalizeSettings,
  settingsFromLegacy,
} from "@/services/nourish/targets";
import type { NourishSettings } from "@/types/nourish";

const SETTINGS_KEY = "@gymos/nourish-settings";
/** Pre-Nourish records. Read once to seed settings, never written. */
const LEGACY_TARGETS_KEY = "@gymos/nutrition-targets";
const LEGACY_PROFILE_KEY = "@gymos/nutrition-profile";

const settingsMutex = createMutex();

async function readUnlocked(): Promise<NourishSettings> {
  const stored = await getStorage<unknown>(SETTINGS_KEY);

  if (stored !== null) {
    return normalizeSettings(stored);
  }

  // First open after the switch: seed from the old targets so nobody
  // starts over. Persisted right away so later reads are stable.
  const [targets, profile] = await Promise.all([
    getStorage<unknown>(LEGACY_TARGETS_KEY).catch(() => null),
    getStorage<unknown>(LEGACY_PROFILE_KEY).catch(() => null),
  ]);
  const seeded = settingsFromLegacy(targets, profile);

  await setStorage(SETTINGS_KEY, seeded);

  return seeded;
}

export async function getNourishSettings(): Promise<NourishSettings> {
  return settingsMutex.runExclusive(readUnlocked);
}

export async function saveNourishSettings(
  settings: NourishSettings,
): Promise<NourishSettings> {
  return settingsMutex.runExclusive(async () => {
    const normalized = normalizeSettings(settings);

    await setStorage(SETTINGS_KEY, normalized);

    return normalized;
  });
}

/** Apply a transformation atomically (read → change → write). */
export async function updateNourishSettings(
  change: (current: NourishSettings) => NourishSettings,
): Promise<NourishSettings> {
  return settingsMutex.runExclusive(async () => {
    const next = normalizeSettings(change(await readUnlocked()));

    await setStorage(SETTINGS_KEY, next);

    return next;
  });
}
