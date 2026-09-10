import type { DailyActivity } from "@/types/gymos";

/**
 * AsyncStorage keys used by the storage layer.
 */
export const DAILY_STORAGE_KEY = "@gymos/daily";

export const NORTH_STAR_STORAGE_KEY = "@gymos/north-star";

/**
 * Type alias for the full daily data store.
 * Keyed by YYYY-MM-DD date strings.
 */
export type DailyData = Record<string, DailyActivity>;
