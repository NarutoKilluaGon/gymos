import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getEnabledModules,
  setModuleEnabled,
  type EnabledModules,
  type ModuleId,
} from "@/storage/repositories/modules";

type ModulesContextValue = {
  enabled: EnabledModules;
  setEnabled: (id: ModuleId, value: boolean) => void;
};

const ModulesContext = createContext<ModulesContextValue | null>(null);

const ALL_ENABLED: EnabledModules = {
  workouts: true,
  nutrition: true,
  progress: true,
};

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<EnabledModules>(ALL_ENABLED);

  useEffect(() => {
    getEnabledModules()
      .then(setEnabledState)
      .catch((error) => {
        // Startup read — fall back to all-enabled rather than crashing.
        console.error("Failed to load module preferences", error);
      });
  }, []);

  const setEnabled = useCallback((id: ModuleId, value: boolean) => {
    setEnabledState((current) => ({ ...current, [id]: value }));

    setModuleEnabled(id, value).catch((error) => {
      console.error(`Failed to persist module preference: ${id}`, error);
    });
  }, []);

  return (
    <ModulesContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules(): ModulesContextValue {
  const context = useContext(ModulesContext);

  if (!context) {
    throw new Error("useModules must be used within <ModulesProvider>");
  }

  return context;
}