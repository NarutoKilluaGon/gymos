import { getDailyActivity, saveDailyActivity } from "@/storage/daily";
import { getStorage } from "@/storage/storage";
import type {
  DailyActivity,
  Measurement,
  MeasurementType,
  MeasurementUnit,
} from "@/types/gymos";
import { getTodayKey } from "@/utils/date";

const DAILY_STORAGE_KEY = "@gymos/daily";

type DailyData = Record<string, DailyActivity>;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

  return measurement;
}

export async function getMeasurements(
  type?: MeasurementType,
): Promise<Measurement[]> {
  const data = (await getStorage<DailyData>(DAILY_STORAGE_KEY)) ?? {};

  return Object.values(data)
    .filter((activity): activity is DailyActivity => Boolean(activity))
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
