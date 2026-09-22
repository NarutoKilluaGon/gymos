import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";

import type { ExportBundle } from "@/services/export";
import { withDailyLock } from "@/storage/daily";

const KEY_PREFIX = "@gymos/";

function parseBundle(parsed: unknown): ExportBundle {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Not a valid GymOS export file");
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    candidate.app !== "gymos" ||
    candidate.format !== 1 ||
    typeof candidate.data !== "object" ||
    candidate.data === null
  ) {
    throw new Error("Not a valid GymOS export file");
  }

  return candidate as unknown as ExportBundle;
}

function serializeValue(value: unknown): string {
  // Export keeps raw strings for non-JSON payloads; object/array values were
  // JSON.parse'd at export time, so re-stringify to restore the stored form.
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Restore an exported GymOS backup. Merges: keys in the file overwrite
 *  matching keys on this device; keys not in the file are left untouched.
 *  Returns the number of keys written. */
export async function importFromUri(uri: string): Promise<number> {
  const file = new File(uri);

  if (!file.exists) {
    throw new Error("Import file could not be read");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error("Not a valid GymOS export file");
  }

  const bundle = parseBundle(parsed);

  const entries: [string, string][] = [];

  for (const [key, value] of Object.entries(bundle.data)) {
    if (!key.startsWith(KEY_PREFIX)) continue;

    entries.push([key, serializeValue(value)]);
  }

  try {
    // Hold the daily mutex across the whole batch write: a concurrent
    // @gymos/daily transaction snapshots the store, then writes it back,
    // so without this lock an in-flight transaction whose snapshot predates
    // the import would clobber the imported data on its next write (and
    // vice versa). All other keys ride along under the same critical
    // section — imports are rare, user-initiated operations.
    await withDailyLock(() => AsyncStorage.multiSet(entries));
  } catch {
    throw new Error("Couldn't save imported data");
  }

  return entries.length;
}