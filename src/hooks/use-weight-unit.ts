import { useCallback, useEffect, useState } from "react";
import {
  getWeightUnit,
  setWeightUnit,
  type WeightUnit,
} from "@/storage/repositories/preferences";

// The preference is shared by every hook instance (Home, Hub, Workouts,
// North Star): a toggle on one screen publishes to all mounted consumers.
// Module-level state keeps this in one file — no context, new files, or
// new dependencies.
let currentUnit: WeightUnit = "kg";
let initialized = false;
let initializing = false;
// Bumped by a local toggle so an in-flight storage read can't clobber it.
let revision = 0;
const listeners = new Set<(unit: WeightUnit) => void>();

function publish(unit: WeightUnit): void {
  currentUnit = unit;
  listeners.forEach((listener) => listener(unit));
}

export function useWeightUnit() {
  const [unit, setUnit] = useState<WeightUnit>(currentUnit);

  useEffect(() => {
    listeners.add(setUnit);

    if (!initialized && !initializing) {
      initializing = true;
      const seenRevision = revision;

      void getWeightUnit().then((stored) => {
        initialized = true;
        initializing = false;

        if (seenRevision === revision) {
          publish(stored);
        }
      });
    }

    return () => {
      listeners.delete(setUnit);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: WeightUnit = currentUnit === "kg" ? "lb" : "kg";
    revision += 1;
    publish(next);
    void setWeightUnit(next);
  }, []);

  return { unit, toggle };
}
