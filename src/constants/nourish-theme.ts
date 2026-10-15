import { Q } from "./quiet";

/**
 * Nourish palette: L · Quiet tokens with sage accent.
 */
export const N = {
  bg: Q.color.bg,
  card: Q.color.card,
  card2: Q.color.surface2,
  line: Q.color.line,
  ink: Q.color.ink,
  mute: Q.color.mute,
  dim: Q.color.mute,
  acc: Q.accent.sage,
  accInk: Q.color.bg,
  gold: Q.accent.brass,
  protein: Q.accent.ember,
  carbs: Q.accent.brass,
  fat: Q.accent.sage,
  ok: Q.accent.sage,
  warn: Q.accent.ember,
  bad: Q.accent.red,
  dockBg: Q.color.surface,
  scrim: Q.color.scrim,
  accent: Q.accent.sage,
} as const;

export const NRadius = {
  card: Q.radius.none,
  control: Q.radius.sm,
  pill: Q.radius.full,
} as const;

export const NSerif = Q.font.displayMedium;
