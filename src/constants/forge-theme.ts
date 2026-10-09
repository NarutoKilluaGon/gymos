import { Platform } from "react-native";

/**
 * Forge palette: warm charcoal with an ember accent. The Workouts screens
 * take every colour from here.
 */
export const F = {
  bg: "#151311",
  card: "#1f1b18",
  card2: "#2a2521",
  line: "rgba(255,240,225,0.09)",
  ink: "#efe8de",
  mute: "#9a9087",
  dim: "#887e74",
  acc: "#e0803f",
  accInk: "#1c0f06",
  warm: "#d9a441",
  ok: "#6fae7a",
  bad: "#d1604a",
  scrim: "rgba(0,0,0,0.6)",
} as const;

export const FRadius = { card: 20, control: 14, pill: 999 } as const;

export const FSerif = Platform.select({
  ios: "ui-serif",
  default: "serif",
}) as string;
