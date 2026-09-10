/**
 * Curated v1 cardio activities (Feature Catalogue Module 02).
 * Cardio is first-class and integrates into workout sessions.
 */

import type { CardioActivity } from "@/types/gymos";

export type CardioActivityDef = {
  id: CardioActivity;
  label: string;
  emoji: string;
  /** Whether the activity commonly records distance (km). */
  hasDistance: boolean;
};

export const CARDIO_ACTIVITIES: CardioActivityDef[] = [
  { id: "running", label: "Running", emoji: "🏃", hasDistance: true },
  { id: "walking", label: "Walking", emoji: "🚶", hasDistance: true },
  { id: "cycling", label: "Cycling", emoji: "🚴", hasDistance: true },
  { id: "swimming", label: "Swimming", emoji: "🏊", hasDistance: true },
  { id: "stairmaster", label: "Stairmaster", emoji: "🪜", hasDistance: false },
  { id: "rowing", label: "Rowing", emoji: "🚣", hasDistance: false },
  { id: "elliptical", label: "Elliptical", emoji: "🏃‍♀️", hasDistance: false },
  { id: "custom", label: "Custom", emoji: "✏️", hasDistance: false },
];

export function findCardioActivity(
  id: CardioActivity,
): CardioActivityDef | undefined {
  return CARDIO_ACTIVITIES.find((a) => a.id === id);
}