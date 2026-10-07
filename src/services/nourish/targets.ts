import type {
  CardioReturn,
  ChangeLogEntry,
  NourishSettings,
  SplitKey,
} from "@/types/nourish";

/** Give a target this long before changing it again; frequent changes
 *  make it impossible to tell what is working. */
export const CHANGE_GUARD_DAYS = 14;

export const SPLITS: readonly SplitKey[] = ["45,25", "40,30", "50,20"];
export const CARDIO_RETURNS: readonly {
  value: CardioReturn;
  label: string;
}[] = [
  { value: 0.5, label: "Half" },
  { value: 1, label: "All" },
  { value: 0, label: "None" },
];

export const DEFAULT_SETTINGS: NourishSettings = {
  kcal: 2600,
  protein: 140,
  split: "45,25",
  cardioReturn: 0.5,
  weeklyRate: 0.25,
  fallbackWeightKg: 65,
  prefs: "",
  changeLog: [],
};

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Coerce a stored record into valid settings; anything missing or
 *  malformed falls back to the default so a bad write can't brick the
 *  screen. */
export function normalizeSettings(raw: unknown): NourishSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS, changeLog: [] };

  const split = SPLITS.find((entry) => entry === raw.split);
  const cardioReturn = CARDIO_RETURNS.find(
    (entry) => entry.value === raw.cardioReturn,
  )?.value;
  const rate =
    typeof raw.weeklyRate === "number" && Number.isFinite(raw.weeklyRate)
      ? raw.weeklyRate
      : undefined;
  const log: ChangeLogEntry[] = Array.isArray(raw.changeLog)
    ? raw.changeLog.filter(
        (entry): entry is ChangeLogEntry =>
          isRecord(entry) &&
          typeof entry.date === "string" &&
          typeof entry.change === "string",
      )
    : [];

  return {
    kcal: finitePositive(raw.kcal) ?? DEFAULT_SETTINGS.kcal,
    protein: finitePositive(raw.protein) ?? DEFAULT_SETTINGS.protein,
    split: split ?? DEFAULT_SETTINGS.split,
    cardioReturn: cardioReturn ?? DEFAULT_SETTINGS.cardioReturn,
    weeklyRate: rate ?? DEFAULT_SETTINGS.weeklyRate,
    fallbackWeightKg:
      finitePositive(raw.fallbackWeightKg) ??
      DEFAULT_SETTINGS.fallbackWeightKg,
    prefs: typeof raw.prefs === "string" ? raw.prefs : "",
    changeLog: log,
  };
}

/** Shape of the pre-Nourish targets/profile records (read-only). */
export type LegacyTargets = {
  calories?: unknown;
  protein?: unknown;
  maintenanceCalories?: unknown;
  calorieGoal?: unknown;
  goalAdjustmentKcal?: unknown;
};

/**
 * Carry the old targets forward the first time Nourish opens: an explicit
 * calorie target wins, else maintenance ± the old goal adjustment. The old
 * records are never modified.
 */
export function settingsFromLegacy(
  targets: unknown,
  profile: unknown,
): NourishSettings {
  const legacy: LegacyTargets = isRecord(targets) ? targets : {};
  const adjustment = finitePositive(legacy.goalAdjustmentKcal) ?? 500;
  const maintenance = finitePositive(legacy.maintenanceCalories);
  const goal = legacy.calorieGoal;
  const fromMaintenance = maintenance
    ? maintenance +
      (goal === "deficit" ? -adjustment : goal === "surplus" ? adjustment : 0)
    : undefined;
  const weight = isRecord(profile) ? finitePositive(profile.weightKg) : undefined;

  return {
    ...DEFAULT_SETTINGS,
    changeLog: [],
    kcal: Math.round(
      finitePositive(legacy.calories) ??
        fromMaintenance ??
        DEFAULT_SETTINGS.kcal,
    ),
    protein: Math.round(
      finitePositive(legacy.protein) ?? DEFAULT_SETTINGS.protein,
    ),
    weeklyRate:
      goal === "deficit" ? -0.5 : goal === "maintain" ? 0 : goal === "surplus"
        ? 0.25
        : DEFAULT_SETTINGS.weeklyRate,
    fallbackWeightKg: weight ?? DEFAULT_SETTINGS.fallbackWeightKg,
  };
}

const CHANGE_LABELS: Record<
  "kcal" | "protein" | "weeklyRate" | "cardioReturn" | "split",
  string
> = {
  kcal: "Calories",
  protein: "Protein",
  weeklyRate: "Weight goal",
  cardioReturn: "Cardio added back",
  split: "Split",
};

/** Human-readable list of what differs, e.g. "Calories 2600 → 2500". */
export function describeChanges(
  previous: NourishSettings,
  next: NourishSettings,
): string[] {
  const keys = Object.keys(CHANGE_LABELS) as (keyof typeof CHANGE_LABELS)[];

  return keys
    .filter((key) => previous[key] !== next[key])
    .map((key) => `${CHANGE_LABELS[key]} ${previous[key]} → ${next[key]}`);
}

/** Whole days since the most recent logged change, or null if none. */
export function daysSinceLastChange(
  log: readonly ChangeLogEntry[],
  now: Date,
): number | null {
  const last = log[log.length - 1];

  if (!last) return null;

  const at = new Date(last.date).getTime();

  if (Number.isNaN(at)) return null;

  return Math.floor((now.getTime() - at) / 86_400_000);
}

/** True when changing targets now would be a second change inside the
 *  guard window. */
export function shouldGuardChange(
  log: readonly ChangeLogEntry[],
  now: Date,
): boolean {
  const days = daysSinceLastChange(log, now);

  return days !== null && days < CHANGE_GUARD_DAYS;
}

export function withChange(
  settings: NourishSettings,
  patch: Partial<NourishSettings>,
  description: string,
  now: Date,
): NourishSettings {
  return {
    ...settings,
    ...patch,
    changeLog: [
      ...settings.changeLog,
      { date: now.toISOString(), change: description },
    ],
  };
}
