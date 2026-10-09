import { CARDIO_ACTIVITIES, matchCardioActivity } from "@/data/cardio";
import type { CardioActivity } from "@/types/gymos";

export const MET: Readonly<Record<string, number>> = Object.fromEntries(
  CARDIO_ACTIVITIES.map((a) => [a.id, a.met]),
);

/** Estimated calories per minute when logged without calories. */
export const WORKOUT_CARDIO_KCAL_PER_MIN = 8;

export type CardioEstimate = {
  activity: CardioActivity;
  name: string;
  detail: string;
  minutes: number;
  distanceKm?: number;
  kcal: number;
  isEstimate: boolean;
  needsActivity?: boolean;
};

const METRES_PER_FLOOR = 3;
const CLIMB_EFFICIENCY = 0.25;
const DESCENT_FACTOR = 1.3;
const JOULES_PER_KCAL = 4184;
const GRAVITY = 9.8;
const KM_PER_MILE = 1.609;

// Build comprehensive regex for detecting cardio
const ALL_ALIASES = CARDIO_ACTIVITIES.flatMap((a) => a.aliases);
const EXTRA_CARDIO_TERMS = [
  "cardio",
  "workout",
  "exercise",
  "floor",
  "floors",
  "flight",
  "flights",
  "storey",
  "storeys",
  "stair",
  "stairs",
  "climb",
  "climbed",
  "climbing",
];

const ALIAS_PATTERN_STR = ALL_ALIASES.concat(EXTRA_CARDIO_TERMS)
  .map((a) => a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
  .join("|");

export const CARDIO_PATTERN = new RegExp(
  `\\b(${ALIAS_PATTERN_STR})\\b|\\d+\\s*(?:km|kms|kilometers?|kilometres?|mi|miles?)\\b`,
  "i",
);

export function looksLikeCardio(text: string): boolean {
  return CARDIO_PATTERN.test(text);
}

/**
 * Standard ACSM metabolic equations for walking and running on an incline.
 * Returns grade-adjusted MET.
 */
function acsmMet(
  isRun: boolean,
  speedKmH: number,
  inclinePercent: number,
): number {
  const speedMMin = (speedKmH * 1000) / 60;
  const grade = inclinePercent / 100;

  if (isRun) {
    // Running formula: VO2 = 3.5 + (0.2 * S) + (0.9 * S * G)
    const vo2 = 3.5 + 0.2 * speedMMin + 0.9 * speedMMin * grade;
    return vo2 / 3.5;
  }

  // Walking formula: VO2 = 3.5 + (0.1 * S) + (1.8 * S * G)
  const vo2 = 3.5 + 0.1 * speedMMin + 1.8 * speedMMin * grade;
  return vo2 / 3.5;
}

/**
 * Deterministic calorie estimate for a typed cardio description.
 * Parses activity, duration, distance, incline and speed.
 * Never silently defaults unknown activities to Walk.
 */
export function estimateCardio(
  text: string,
  weightKg: number,
): CardioEstimate | null {
  const clean = text.trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();

  // 1. FLOORS / STAIRS
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
      activity: "stairmaster",
      name: "Stair climb",
      detail:
        reps > 1
          ? `${count} floors × ${reps}, about ${metres} m climbed`
          : `${count} floors, about ${metres} m climbed`,
      minutes: 0,
      kcal,
      isEstimate: true,
    };
  }

  // 2. PARSE ACTIVITY
  const matchedDef = matchCardioActivity(lower);

  // 3. PARSE DURATION
  // m alone is NOT minutes
  const hoursMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hr|hrs|hours?|h)\b/i);
  const minsMatch = lower.match(
    /\b(\d+(?:\.\d+)?)\s*(?:min|mins|minutes)\b/i,
  );

  let minutes = minsMatch
    ? Number(minsMatch[1])
    : hoursMatch
      ? Number(hoursMatch[1]) * 60
      : 0;
  minutes = Math.round(minutes * 10) / 10;

  // 4. PARSE DISTANCE
  // Avoid matching incomplete "mi" while typing "min"
  let distanceKm: number | undefined;
  const isTypingMi = /(?:^|\s)\d+(?:\.\d+)?\s*mi$/i.test(lower);
  if (!isTypingMi) {
    const distMatch = lower.match(
      /\b(\d+(?:\.\d+)?)\s*(km|kms|kilometers?|kilometres?|mi|miles?)\b(?!\w)/i,
    );
    if (distMatch) {
      const val = Number(distMatch[1]);
      const unit = distMatch[2].toLowerCase();
      distanceKm = unit.startsWith("mi") ? val * KM_PER_MILE : val;
      distanceKm = Math.round(distanceKm * 100) / 100;
    }
  }

  // 5. PARSE INCLINE & SPEED
  const inclineMatch =
    lower.match(/\b(?:on\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:incline|grade|gradient)\b/i) ||
    lower.match(/\b(?:incline|grade|gradient)\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)?\b/i);
  const inclinePercent = inclineMatch ? Number(inclineMatch[1]) : 0;

  const speedMatch =
    lower.match(/\b(?:at\s+)?(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph|mph)\s*(?:speed)?\b/i) ||
    lower.match(/\bspeed\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph|mph)?\b/i);
  const rawSpeed = speedMatch ? Number(speedMatch[1]) : undefined;
  const isMph = speedMatch && speedMatch[0].includes("mph");
  const speedKmH = rawSpeed ? (isMph ? rawSpeed * KM_PER_MILE : rawSpeed) : undefined;

  // If no time or distance was specified, cannot estimate
  if (minutes <= 0 && (!distanceKm || distanceKm <= 0)) {
    return null;
  }

  // Activity definition
  const isRun = matchedDef?.id === "running" || matchedDef?.id === "jogging";
  const isWalk = matchedDef?.id === "walking" || matchedDef?.id === "treadmill";

  // Calculate MET with potential incline/speed grade adjustment
  let effectiveMet = matchedDef?.met ?? 4.5;

  if ((isWalk || isRun) && (inclinePercent > 0 || speedKmH !== undefined)) {
    const defaultSpeed = isRun ? 9 : 5;
    const finalSpeed = speedKmH ?? defaultSpeed;
    effectiveMet = acsmMet(isRun, finalSpeed, inclinePercent);
  }

  // Calorie calculation
  let kcal = 0;
  if (minutes > 0) {
    kcal = Math.round((effectiveMet * weightKg * minutes) / 60);
  } else if (distanceKm) {
    const factor = matchedDef?.distanceFactor ?? (isRun ? 1.0 : isWalk ? 0.55 : 0.4);
    kcal = Math.round(weightKg * distanceKm * factor);
  }

  // Detail text
  let detail = "";
  if (minutes > 0) {
    detail = `${Math.round(minutes)} min`;
    if (inclinePercent > 0) {
      detail += `, ${inclinePercent}% incline`;
    }
    if (speedKmH !== undefined) {
      detail += ` @ ${Math.round(speedKmH * 10) / 10} km/h`;
    }
  } else if (distanceKm) {
    detail = `${Math.round(distanceKm * 10) / 10} km`;
  }

  // Activity name and missing activity check
  const activityName = matchedDef ? matchedDef.label : "Cardio";
  const needsActivity = !matchedDef;

  return {
    activity: matchedDef?.id ?? "other",
    name: activityName,
    detail,
    minutes: Math.round(minutes),
    distanceKm,
    kcal,
    isEstimate: true,
    needsActivity,
  };
}
