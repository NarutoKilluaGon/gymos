import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
const KEY_PREFIX = "@gymos/";
const PHOTOS_KEY = "@gymos/progress-photos";

/**
 * Lossless JSON snapshot of every `@gymos/*` storage key.
 * The shape is versioned so a future import can validate the format.
 */
export type ExportBundle = {
  app: "gymos";
  format: 1;
  version: string;
  exportedAt: string;
  data: Record<string, unknown>;
  /** Progress photo bytes keyed by photo ID (base64). Only present when
   *  at least one photo file was collected; older exports without the
   *  field still import unchanged. */
  files?: Record<string, string>;
};

/** Best-effort base64 snapshot of every progress photo file. Missing or
 *  unreadable files are skipped so one bad photo can't fail the export —
 *  its metadata still ships and the import leaves that uri untouched. */
async function collectPhotoFiles(
  photos: unknown,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  if (!Array.isArray(photos)) {
    return files;
  }

  for (const photo of photos) {
    if (typeof photo !== "object" || photo === null) continue;

    const id = (photo as { id?: unknown }).id;
    const uri = (photo as { uri?: unknown }).uri;

    if (typeof id !== "string" || typeof uri !== "string") continue;

    try {
      const file = new File(uri);

      if (!file.exists) continue;

      files[id] = await file.base64();
    } catch {
      // Skip unreadable photo files; their metadata still exports.
    }
  }

  return files;
}

export async function buildExport(): Promise<ExportBundle> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key.startsWith(KEY_PREFIX),
  );

  const pairs = await AsyncStorage.multiGet(keys);

  const data: Record<string, unknown> = {};

  for (const [key, raw] of pairs) {
    if (raw === null) continue;

    try {
      data[key] = JSON.parse(raw) as unknown;
    } catch {
      // Keep the raw string if a key holds non-JSON data.
      data[key] = raw;
    }
  }

  const files = await collectPhotoFiles(data[PHOTOS_KEY]);

  const bundle: ExportBundle = {
    app: "gymos",
    format: 1,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  // Only carry `files` when at least one blob was collected, so
  // photoless exports keep the original minimal shape.
  if (Object.keys(files).length > 0) {
    bundle.files = files;
  }

  return bundle;
}

export async function exportToFile(): Promise<string> {
  const bundle = await buildExport();
  const payload = JSON.stringify(bundle, null, 2);

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const file = new File(Paths.cache, `gymos-export-${stamp}.json`);
  file.create({ overwrite: true });
  file.write(payload);

  return file.uri;
}

export async function shareExport(): Promise<void> {
  const uri = await exportToFile();

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing not available");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Export GymOS data",
  });
}