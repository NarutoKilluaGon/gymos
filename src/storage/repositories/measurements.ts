import { getAllDailyActivities, getDailyActivity, saveDailyActivity } from "@/storage/daily";
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
  const activity = await getDailyActivity(getTodayKey());

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

  await saveDailyActivity(activity);

  if (type === "weight") {
    await appendEvent("weight.logged", {
      weight: value,
      unit,
    });
  } else {
    await appendEvent("measurement.logged", {
      measurementId: measurement.id,
      type,
      value,
      unit,
    });
  }

  return measurement;
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

export async function getMeasurementHistory(
  type: MeasurementType,
): Promise<Measurement[]> {
  const measurements = await getMeasurements(type);

  return [...measurements].reverse();
}
