import { Q } from "./quiet";

/**
 * Forge palette: warm charcoal with an ember accent. The Workouts screens
 * take every colour from here.
 */
export const F = {
  bg: Q.color.bg,
  card: Q.color.card,
  card2: Q.color.surface2,
  line: Q.color.line,
  ink: Q.color.ink,
  mute: Q.color.mute,
  dim: Q.color.mute,
  acc: Q.accent.ember,
  accInk: Q.color.bg,
  warm: Q.accent.ember,
  ok: Q.accent.sage,
  bad: Q.accent.red,
  scrim: Q.color.scrim,
  accent: Q.accent.ember,
} as const;

export const FRadius = {
  card: Q.radius.none,
  control: Q.radius.sm,
  pill: Q.radius.full,
} as const;

export const FSerif = Q.font.displayMedium;
