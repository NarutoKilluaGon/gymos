import { getAllDailyActivities, readAllDailyActivitiesUnlocked, readDailyActivityUnlocked, withDailyLock, writeDailyActivityUnlocked } from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type {
  Measurement,
  MeasurementType,
  MeasurementUnit,
} from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function addMeasurement(
  type: MeasurementType,
  value: number,
  unit: MeasurementUnit,
): Promise<Measurement> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

    const measurement: Measurement = {
      id: createId(),
      type,
      value,
      unit,
      timestamp: new Date().toISOString(),
    };

    if (!Array.isArray(activity.measurements)) {
      activity.measurements = [];
    }

    activity.measurements.push(measurement);

    await writeDailyActivityUnlocked(activity);

    return measurement;
  });

  if (type === "weight") {
    await appendEvent("weight.logged", {
      weight: value,
      unit,
      measurementId: saved.id,
    });
  } else {
    await appendEvent("measurement.logged", {
      measurementId: saved.id,
      type,
      value,
      unit,
    });
  }

  return saved;
}

/**
 * Replace today's weight reading with `value`: one atomic transaction, so a
 * day never holds two readings. Everything (find today's weight readings,
 * drop them, add the new one) happens under the daily lock and lands in a
 * single write — concurrent calls serialize, and a failed write leaves the
 * previous reading untouched instead of deleting it. Readings of other
 * types and other days are not touched. Any duplicate weight readings
 * already stored for today are collapsed into the one replacement.
 */
export async function replaceTodayWeight(
  value: number,
  unit: MeasurementUnit,
): Promise<Measurement> {
  const { saved, removedIds } = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(getTodayKey());
    const existing = Array.isArray(activity.measurements)
      ? activity.measurements
      : [];
    const isWeight = (m: Measurement | null | undefined): m is Measurement =>
      m != null && typeof m === "object" && m.type === "weight";

    const measurement: Measurement = {
      id: createId(),
      type: "weight",
      value,
      unit,
      timestamp: new Date().toISOString(),
    };

    activity.measurements = [
      ...existing.filter((m) => !isWeight(m)),
      measurement,
    ];

    await writeDailyActivityUnlocked(activity);

    return {
      saved: measurement,
      removedIds: existing.filter(isWeight).map((m) => m.id),
    };
  });

  for (const measurementId of removedIds) {
    await appendEvent("measurement.deleted", { measurementId });
  }

  await appendEvent("weight.logged", {
    weight: value,
    unit,
    measurementId: saved.id,
  });

  return saved;
}

export async function getMeasurements(
  type?: MeasurementType,
): Promise<Measurement[]> {
  const data = await getAllDailyActivities();

  return Object.values(data)
    .flatMap((activity) =>
      Array.isArray(activity.measurements) ? activity.measurements : [],
    )
    .filter(
      (measurement): measurement is Measurement =>
        measurement != null &&
        typeof measurement === "object" &&
        (type === undefined || measurement.type === type),
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export async function getLatestMeasurement(
  type: MeasurementType,
): Promise<Measurement | undefined> {
  const measurements = await getMeasurements(type);

  return measurements[0];
}

export async function deleteMeasurement(
  measurementId: string,
): Promise<void> {
  const deleted = await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const activity of Object.values(data)) {
      if (!Array.isArray(activity.measurements)) {
        continue;
      }

      if (!activity.measurements.some((m) => m.id === measurementId)) {
        continue;
      }

      activity.measurements = activity.measurements.filter(
        (measurement) => measurement.id !== measurementId,
      );

      await writeDailyActivityUnlocked(activity);
      return true;
    }

    return false;
  });

  if (deleted) {
    await appendEvent("measurement.deleted", { measurementId });
  }
}

/** Restore a previously deleted measurement. */
export async function restoreMeasurement(
  measurement: Measurement,
): Promise<void> {
  await withDailyLock(async () => {
    const date = measurement.timestamp.slice(0, 10);
    const activity = await readDailyActivityUnlocked(date);
    if (!Array.isArray(activity.measurements)) {
      activity.measurements = [];
    }
    if (!activity.measurements.some((m) => m.id === measurement.id)) {
      activity.measurements.push(measurement);
      await writeDailyActivityUnlocked(activity);
    }
  });
}

export async function getMeasurementHistory(
  type: MeasurementType,
): Promise<Measurement[]> {
  const measurements = await getMeasurements(type);

  return [...measurements].reverse();
}
