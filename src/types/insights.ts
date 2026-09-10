/**
 * Data shapes for the Insights service and components.
 * These are derived views over the daily activity blob — nothing here
 * is persisted directly.
 */

export type HeatmapCell = {
  date: string;
  count: number;
};

export type HeatmapWeek = {
  label: string;
  cells: HeatmapCell[];
};

export type WeekStats = {
  startDate: string;
  endDate: string;
  workoutDays: number;
  workouts: number;
  minutes: number;
  weightLatest: number | null;
  weightUnit: string | null;
  weightChange: number | null;
  caloriesAverage: number | null;
  calorieDays: number;
  journalCount: number;
};

export type WeekInsights = {
  current: WeekStats;
  previous: WeekStats;
};

export type MonthlySummary = {
  monthKey: string;
  label: string;
  workouts: number;
  workoutDays: number;
  minutes: number;
  caloriesAverage: number | null;
  calorieDays: number;
  weightChange: number | null;
  weightUnit: string | null;
  journalCount: number;
};

export type VolumePoint = {
  weekKey: string;
  label: string;
  volume: number;
};

export type GoalProgress = {
  hasTarget: boolean;
  title: string;
  why?: string;
  goalType?: string;
  goalTypeLabel?: string;
  metric: string;
  current: number | null;
  target: number;
  unit: string;
  percent: number;
  direction: "ascending" | "descending";
};