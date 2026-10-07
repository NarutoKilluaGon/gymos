import { Platform } from "react-native";

/**
 * Nourish palette. The app is dark-only, so this is the dark variant of the
 * design; every colour in the Nutrition screens comes from here so a light
 * variant is a one-object change.
 */
export const N = {
  bg: "#121614",
  card: "#1a201d",
  card2: "#222a26",
  line: "#2b3530",
  ink: "#ece8df",
  mute: "#9aa59e",
  dim: "#6c776f",
  acc: "#81a996",
  accInk: "#0f1a15",
  gold: "#d4a24c",
  protein: "#c8735a",
  carbs: "#d4a24c",
  fat: "#8a9a5b",
  ok: "#4c9a6a",
  warn: "#d9a441",
  bad: "#c8634b",
  scrim: "rgba(0,0,0,0.55)",
} as const;

export const NRadius = { card: 20, control: 14, pill: 999 } as const;

/** Serif display face for big numbers and titles (Fraunces in the design;
 *  the platform serif here, since no font files ship with the app). */
export const NSerif = Platform.select({
  ios: "ui-serif",
  default: "serif",
}) as string;
