import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
const KEY_PREFIX = "@gymos/";

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
};

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

  return {
    app: "gymos",
    format: 1,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
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