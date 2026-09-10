import { getStorage, setStorage } from "@/storage/storage";

export type ModuleId = "workouts" | "nutrition" | "progress";

export type EnabledModules = Record<ModuleId, boolean>;

const MODULES_KEY = "@gymos/modules";

const DEFAULT_MODULES: EnabledModules = {
  workouts: true,
  nutrition: true,
  progress: true,
};

export async function getEnabledModules(): Promise<EnabledModules> {
  const stored = await getStorage<EnabledModules>(MODULES_KEY);

  return stored ?? DEFAULT_MODULES;
}

export async function setModuleEnabled(
  id: ModuleId,
  enabled: boolean,
): Promise<void> {
  const current = await getEnabledModules();

  await setStorage(MODULES_KEY, { ...current, [id]: enabled });
}
