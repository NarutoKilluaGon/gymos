import { F } from "./forge-theme";
import { N } from "./nourish-theme";
import { Q } from "./quiet";

export type Theme = {
  bg: string;
  card: string;
  card2: string;
  line: string;
  ink: string;
  mute: string;
  dim: string;
  acc: string;
  accInk: string;
  ok: string;
  bad: string;
  warn: string;
  scrim: string;
  accent: string;
};

/**
 * HOME palette: L · Quiet tokens with brass accent.
 */
export const HOME: Theme = {
  bg: Q.color.bg,
  card: Q.color.card,
  card2: Q.color.surface2,
  line: Q.color.line,
  ink: Q.color.ink,
  mute: Q.color.mute,
  dim: Q.color.mute,
  acc: Q.accent.brass,
  accInk: Q.color.bg,
  ok: Q.accent.sage,
  bad: Q.accent.red,
  warn: Q.accent.ember,
  scrim: Q.color.scrim,
  accent: Q.accent.brass,
};

/**
 * Forge palette adapter (Workouts / ember).
 */
export const FORGE: Theme & { warm: string } = {
  bg: F.bg,
  card: F.card,
  card2: F.card2,
  line: F.line,
  ink: F.ink,
  mute: F.mute,
  dim: F.dim,
  acc: F.acc,
  accInk: F.accInk,
  ok: F.ok,
  bad: F.bad,
  warn: F.warm,
  warm: F.warm,
  scrim: F.scrim,
  accent: F.accent,
};

/**
 * Nourish palette adapter (Nutrition / sage).
 */
export const NOURISH: Theme & {
  gold: string;
  protein: string;
  carbs: string;
  fat: string;
} = {
  bg: N.bg,
  card: N.card,
  card2: N.card2,
  line: N.line,
  ink: N.ink,
  mute: N.mute,
  dim: N.dim,
  acc: N.acc,
  accInk: N.accInk,
  ok: N.ok,
  bad: N.bad,
  warn: N.warn,
  gold: N.gold,
  protein: N.protein,
  carbs: N.carbs,
  fat: N.fat,
  scrim: N.scrim,
  accent: N.accent,
};

export type ModuleThemeKey = "home" | "forge" | "nourish" | "hub";

export const THEMES: Record<ModuleThemeKey, Theme> = {
  home: HOME,
  forge: FORGE,
  nourish: NOURISH,
  hub: HOME,
};

export function getTheme(moduleKey: ModuleThemeKey): Theme {
  return THEMES[moduleKey] ?? HOME;
}

export const Gutter = 16;

export const Space = {
  xxs: Q.space[1],
  xs: Q.space[2],
  s: Q.space[3],
  m: Q.space[4],
  l: Q.space[5],
  xl: Q.space[6],
  xxl: Q.space[8],
} as const;

export const Metric = {
  touchMin: 44,
  buttonHeight: 44,
  setRowHeight: 48,
  listRowHeight: 52,
  cardRadius: Q.radius.none,
  controlRadius: Q.radius.sm,
  pillRadius: Q.radius.full,
  gutter: Gutter,
} as const;

export const Radius = {
  card: Q.radius.none,
  control: Q.radius.sm,
  pill: Q.radius.full,
} as const;

export const Font = {
  serif: Q.font.displayMedium,
  sans: Q.font.sansRegular,
  mono: "monospace",
};

export const Type = {
  // Quiet Display roles
  display: Q.type.display,
  title: Q.type.title,
  titleLarge: Q.type.titleLarge,
  section: {
    fontFamily: Q.font.displayMedium,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "500" as const,
    letterSpacing: -0.2,
  },
  numeralXL: Q.type.numDisplay,
  numeralM: Q.type.numMedium,

  // Quiet Sans roles
  body: Q.type.body,
  bodyLarge: Q.type.bodyLarge,
  bodyMedium: Q.type.bodyMedium,
  rowTitle: {
    fontFamily: Q.font.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  meta: Q.type.caption,
  eyebrow: {
    fontFamily: Q.font.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    fontWeight: "500" as const,
  },
  button: {
    fontFamily: Q.font.sansMedium,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500" as const,
  },
  input: {
    fontFamily: Q.font.sansRegular,
    fontSize: 15,
    fontWeight: "400" as const,
  },

  // Backward compatibility aliases
  titleSm: {
    fontFamily: Q.font.displayMedium,
    fontSize: 18,
    fontWeight: "500" as const,
    lineHeight: 22,
  },
  caption: Q.type.caption,
  captionMedium: Q.type.captionMedium,
  micro: Q.type.micro,
  numeral: {
    fontFamily: Q.font.displaySemiBold,
    fontVariant: ["tabular-nums" as const],
  },
};
