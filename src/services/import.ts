import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import type { ExportBundle } from "@/services/export";
import { withDailyLock } from "@/storage/daily";

const KEY_PREFIX = "@gymos/";
const PHOTOS_KEY = "@gymos/progress-photos";
/** Exact shape of createId() (src/utils/id.ts), the app's only ID
 *  generator: a timestamp, a hyphen, a base36 random string. Checked
 *  before an imported ID becomes a filename so a crafted bundle can't
 *  route the write out of the photos directory with "/" or "..". */
const PHOTO_ID_PATTERN = /^[0-9]+-[a-z0-9]+$/;

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

/** Materialize bundled photo bytes into this device's photo directory and
 *  rewrite each photo's `uri` to the local copy (exported paths belong to
 *  the origin device). Runs before any storage write: if this throws,
 *  AsyncStorage is left untouched. Bundles without photo files no-op. */
function materializePhotoFiles(bundle: ExportBundle): void {
  const files = bundle.files;
  const photos = bundle.data[PHOTOS_KEY];

  if (
    !files ||
    typeof files !== "object" ||
    !Array.isArray(photos)
  ) {
    return;
  }

  try {
    const directory = new Directory(Paths.document, "progress-photos");

    if (!directory.exists) {
      directory.create({ intermediates: true, idempotent: true });
    }

    for (const photo of photos) {
      if (typeof photo !== "object" || photo === null) continue;

      const record = photo as { id?: unknown; uri?: unknown };
      const id = record.id;

      if (typeof id !== "string" || !PHOTO_ID_PATTERN.test(id)) continue;

      const blob = files[id];

      if (typeof blob !== "string") continue;

      const destination = new File(directory, `${id}.jpg`);
      destination.create({ overwrite: true });
      destination.write(blob, { encoding: "base64" });
      record.uri = destination.uri;
    }
  } catch {
    throw new Error("Couldn't save imported photos");
  }
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

  // Rewrite photo URIs and write photo files first: a failure here must
  // abort the import before any storage key is touched.
  materializePhotoFiles(bundle);

  const entries: [string, string][] = [];

  for (const [key, value] of Object.entries(bundle.data)) {
    if (!key.startsWith(KEY_PREFIX)) continue;

    entries.push([key, serializeValue(value)]);
  }

  // A backup taken before meals got their own storage key still carries
  // its meals embedded inside "@gymos/daily" — this restore is about to
  // overwrite that key, but has nothing to write for "@gymos/meals"
  // itself (merge leaves it untouched). Without this, this device's
  // already-migrated flag would stay true and those restored meals
  // would never move into the dedicated store: invisible, not deleted,
  // but effectively lost. Forcing the flag false makes meals.ts safely
  // re-derive/re-merge (by id, so nothing already there gets duplicated)
  // the next time anything touches meals.
  const restoresDaily = bundle.data["@gymos/daily"] !== undefined;
  const restoresMeals = bundle.data["@gymos/meals"] !== undefined;

  if (restoresDaily && !restoresMeals) {
    entries.push(["@gymos/meals-migrated-v1", serializeValue(false)]);
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