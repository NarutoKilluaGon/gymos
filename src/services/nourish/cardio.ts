/** Matches text that describes exercise rather than food, so the log bar
 *  can route it to the cardio sheet. */
export const CARDIO_PATTERN =
  /\b(cardio|workout|walk\w*|jog\w*|run|running|ran|cycl\w*|swim\w*|hik\w*|hiit|skipping|rowing|climb\w*|stairs?|storey|floors?|football|badminton)\b|\d\s*(km|mi|miles?)\b/i;

export function looksLikeCardio(text: string): boolean {
  return CARDIO_PATTERN.test(text);
}

/** Metabolic equivalents (MET) for common activities. */
export const MET: Readonly<Record<string, number>> = {
  walk: 3.5,
  jog: 7,
  run: 9.8,
  cycl: 7.5,
  swim: 6,
  hiit: 9,
  skipping: 11,
  rope: 11,
  rowing: 7,
  hik: 6,
  football: 8,
  badminton: 5.5,
};

const DISPLAY_NAME: Record<string, string> = {
  walk: "Walk",
  jog: "Jog",
  run: "Run",
  cycl: "Cycle",
  swim: "Swim",
  hiit: "HIIT",
  skipping: "Skipping",
  rope: "Skipping",
  rowing: "Rowing",
  hik: "Hike",
  football: "Football",
  badminton: "Badminton",
};

/** Estimated calories per minute when the Workouts module logged cardio
 *  without calories. Matches the rate the app has always assumed. */
export const WORKOUT_CARDIO_KCAL_PER_MIN = 8;

export type CardioEstimate = {
  name: string;
  detail: string;
  minutes: number;
  kcal: number;
};

const METRES_PER_FLOOR = 3;
/** Climbing is ~25% efficient; the descent adds about 30% on top. */
const CLIMB_EFFICIENCY = 0.25;
const DESCENT_FACTOR = 1.3;
const JOULES_PER_KCAL = 4184;
const GRAVITY = 9.8;
const KM_PER_MILE = 1.609;

/**
 * Deterministic calorie estimate for a typed cardio description. Handles
 * a duration with a known activity (MET × kg × hours), a distance on its
 * own, and stair/floor climbing. Returns null when there is nothing to
 * estimate from, so the caller can ask for a time or distance.
 */
export function estimateCardio(
  text: string,
  weightKg: number,
): CardioEstimate | null {
  const lower = text.toLowerCase();

  const floors = lower.match(
    /(\d+(?:\.\d+)?)\s*(?:floors?|flights?|storeys?|stories)\b(?:\s*[x×*]\s*(\d+)|,?\s*(\d+)\s*(?:times|reps))?/,
  );

  if (floors) {
    const count = Number(floors[1]);
    const reps = Number(floors[2] ?? floors[3] ?? 1);
    const metres = Math.round(count * reps * METRES_PER_FLOOR);
    const kcal = Math.round(
      ((metres * weightKg * GRAVITY) / CLIMB_EFFICIENCY / JOULES_PER_KCAL) *
        DESCENT_FACTOR,
    );

    return {
      name: "Stair climb",
      detail:
        reps > 1
          ? `${count} floors × ${reps}, about ${metres} m climbed`
          : `${count} floors, about ${metres} m climbed`,
      minutes: 0,
      kcal,
    };
  }

  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hours?)\b/);
  const mins = lower.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minutes|m)\b/);
  const minutes = mins
    ? Number(mins[1])
    : hours
      ? Number(hours[1]) * 60
      : 0;
  const words = lower.split(/\W+/);
  const activity = Object.keys(MET).find((key) =>
    words.some((word) => word.startsWith(key)),
  );

  if (minutes > 0 && activity) {
    return {
      name: DISPLAY_NAME[activity] ?? "Cardio",
      detail: `${Math.round(minutes)} min`,
      minutes: Math.round(minutes),
      kcal: Math.round(((MET[activity] ?? 0) * weightKg * minutes) / 60),
    };
  }

  const distance = lower.match(/(\d+(?:\.\d+)?)\s*(km|mi|miles?)\b/);

  if (distance) {
    const km =
      Number(distance[1]) * (distance[2] === "km" ? 1 : KM_PER_MILE);
    const running = /run|jog/.test(lower);
    const cycling = /cycl/.test(lower);
    const perKgPerKm = running ? 1 : cycling ? 0.3 : 0.55;

    return {
      name: running ? "Run" : cycling ? "Cycle" : "Walk",
      detail: `${Math.round(km * 10) / 10} km`,
      minutes: 0,
      kcal: Math.round(weightKg * km * perKgPerKm),
    };
  }

  return null;
}
