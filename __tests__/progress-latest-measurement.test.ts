import { latestMeasurement } from "@/services/progress-chart";
import {
  deleteMeasurement,
  getMeasurementHistory,
} from "@/storage/repositories/measurements";
import { setStorage } from "@/storage/storage";
import type { DailyActivity, Measurement } from "@/types/gymos";
import { timestampForKey } from "@/utils/date";

function reading(
  id: string,
  type: Measurement["type"],
  value: number,
  key: string,
  hm = "07:30",
): Measurement {
  return {
    id,
    type,
    value,
    unit: type === "weight" ? "kg" : "cm",
    timestamp: timestampForKey(key, hm),
  };
}

function day(key: string, measurements: Measurement[]): DailyActivity {
  return {
    date: key,
    water: [],
    workouts: [],
    meals: [],
    sleep: [],
    measurements,
    journal: [],
  };
}

/** Three weight readings on three days, stored out of date order on purpose,
 *  plus a waist reading that must never be mistaken for a weight. */
async function seed(): Promise<void> {
  await setStorage("@gymos/daily", {
    "2026-06-03": day("2026-06-03", [
      reading("w-newest", "weight", 78, "2026-06-03"),
    ]),
    "2026-06-01": day("2026-06-01", [
      reading("w-oldest", "weight", 80, "2026-06-01"),
      reading("waist-1", "waist", 90, "2026-06-01"),
    ]),
    "2026-06-02": day("2026-06-02", [
      reading("w-middle", "weight", 79, "2026-06-02"),
    ]),
  });
}

describe("Progress latest measurement", () => {
  it("history is oldest first, so the first element is NOT the latest", async () => {
    await seed();

    const history = await getMeasurementHistory("weight");

    expect(history.map((m) => m.id)).toEqual([
      "w-oldest",
      "w-middle",
      "w-newest",
    ]);
  });

  it("resolves the newest reading from multiple measurements", async () => {
    await seed();

    const latest = latestMeasurement(await getMeasurementHistory("weight"));

    expect(latest?.id).toBe("w-newest");
    expect(latest?.value).toBe(78);
  });

  it("resolves the newest reading per type", async () => {
    await seed();

    expect(latestMeasurement(await getMeasurementHistory("waist"))?.id).toBe(
      "waist-1",
    );
  });

  it("returns undefined when there is no history", () => {
    expect(latestMeasurement(undefined)).toBeUndefined();
    expect(latestMeasurement([])).toBeUndefined();
  });

  it("delete-latest targets the newest measurement id and keeps the older ones", async () => {
    await seed();

    // Exactly what handleMeasurementDelete does before confirming.
    const target = latestMeasurement(await getMeasurementHistory("weight"));

    expect(target?.id).toBe("w-newest");

    await deleteMeasurement(target!.id);

    const remaining = await getMeasurementHistory("weight");

    expect(remaining.map((m) => m.id)).toEqual(["w-oldest", "w-middle"]);
    // The next "latest" is now the previous reading.
    expect(latestMeasurement(remaining)?.id).toBe("w-middle");
  });
});
