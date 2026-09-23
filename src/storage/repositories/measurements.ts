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

    for (const [dayKey, activity] of Object.entries(data)) {
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

export async function getMeasurementHistory(
  type: MeasurementType,
): Promise<Measurement[]> {
  const measurements = await getMeasurements(type);

  return [...measurements].reverse();
}
