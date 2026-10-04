import type { ForgeSettings, Plan, PlanDay, PlanExercise } from "@/types/forge";

export const DEFAULT_REST_SECONDS = 90;
export const MAX_REST_SECONDS = 600;
export const DEFAULT_BAR_KG = 20;

export const DEFAULT_FORGE_SETTINGS: ForgeSettings = {
  plans: [],
  activePlanId: "",
  restSeconds: DEFAULT_REST_SECONDS,
  barKg: DEFAULT_BAR_KG,
  routinesImported: false,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function normalizeExercise(raw: unknown): PlanExercise | null {
  if (!isObject(raw)) return null;

  const exerciseId = text(raw.exerciseId);
  const name = text(raw.name);

  if (!exerciseId || !name) return null;

  const sets = finite(raw.sets);
  const weight = finite(raw.weight);
  const tip = text(raw.tip);

  return {
    exerciseId,
    name,
    sets: Math.min(20, Math.max(1, Math.round(sets ?? 3))),
    reps: text(raw.reps) ?? "8-10",
    weight: weight !== null && weight > 0 ? weight : 0,
    ...(tip ? { tip } : {}),
    ...(raw.superset === true ? { superset: true } : {}),
  };
}

function normalizeDay(raw: unknown): PlanDay | null {
  if (!isObject(raw)) return null;

  const id = text(raw.id);
  const name = text(raw.name);

  if (!id || !name) return null;

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises
        .map(normalizeExercise)
        .filter((entry): entry is PlanExercise => entry !== null)
    : [];

  return { id, name, exercises };
}

function normalizePlan(raw: unknown): Plan | null {
  if (!isObject(raw)) return null;

  const id = text(raw.id);
  const name = text(raw.name);

  if (!id || !name) return null;

  const seen = new Set<string>();
  const days = (Array.isArray(raw.days) ? raw.days : [])
    .map(normalizeDay)
    .filter((day): day is PlanDay => {
      if (!day || seen.has(day.id)) return false;

      seen.add(day.id);

      return true;
    });

  const schedule: Record<string, string> = {};

  if (isObject(raw.schedule)) {
    for (const [key, value] of Object.entries(raw.schedule)) {
      if (/^[0-6]$/.test(key) && typeof value === "string" && seen.has(value)) {
        schedule[key] = value;
      }
    }
  }

  return {
    id,
    name,
    days,
    schedule,
    rotate: raw.rotate === true,
    deload: raw.deload === true,
    updatedAt: text(raw.updatedAt) ?? new Date(0).toISOString(),
  };
}

/** Defensive read: anything malformed is dropped, never thrown on. */
export function normalizeForgeSettings(raw: unknown): ForgeSettings {
  const source = isObject(raw) ? raw : {};
  const plans = (Array.isArray(source.plans) ? source.plans : [])
    .map(normalizePlan)
    .filter((plan): plan is Plan => plan !== null);

  const wanted = text(source.activePlanId);
  const activePlanId =
    wanted && plans.some((plan) => plan.id === wanted)
      ? wanted
      : (plans[0]?.id ?? "");

  const rest = finite(source.restSeconds);
  const bar = finite(source.barKg);

  return {
    plans,
    activePlanId,
    restSeconds:
      rest === null
        ? DEFAULT_REST_SECONDS
        : Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(rest))),
    barKg: bar !== null && bar > 0 ? bar : DEFAULT_BAR_KG,
    routinesImported: source.routinesImported === true,
  };
}

export function activePlan(settings: ForgeSettings): Plan | null {
  return (
    settings.plans.find((plan) => plan.id === settings.activePlanId) ??
    settings.plans[0] ??
    null
  );
}
