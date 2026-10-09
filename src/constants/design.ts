import { Platform } from "react-native";
import { F } from "./forge-theme";
import { N } from "./nourish-theme";

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
};

/**
 * HOME palette: Calm charcoal surfaces with GymOS shared gold identity.
 * Raised dim text to >= 4.5:1 contrast against bg.
 */
export const HOME: Theme = {
  bg: "#101010",
  card: "#181818",
  card2: "#222222",
  line: "rgba(255, 255, 255, 0.08)",
  ink: "#f5f2eb",
  mute: "#a39e95",
  dim: "#888278",
  acc: "#d4a24c",
  accInk: "#1a1408",
  ok: "#4c9a6a",
  bad: "#c8634b",
  warn: "#d9a441",
  scrim: "rgba(0, 0, 0, 0.6)",
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

export const Gutter = 20;

export const Space = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
} as const;

export const Metric = {
  touchMin: 44,
  buttonHeight: 48,
  setRowHeight: 52,
  listRowHeight: 56,
  cardRadius: 20,
  controlRadius: 14,
  pillRadius: 999,
  gutter: Gutter,
} as const;

export const Radius = {
  card: 20,
  control: 14,
  pill: 999,
} as const;

export const Font = {
  serif: Platform.select({
    ios: "ui-serif",
    default: "serif",
  }) as string,
  sans: Platform.select({
    ios: "system-ui",
    default: "normal",
  }) as string,
  mono: Platform.select({
    ios: "ui-monospace",
    default: "monospace",
  }) as string,
};

export const Type = {
  // Serif roles (>= 20px, titles & big numerals only)
  display: {
    fontFamily: Font.serif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "300" as const,
  },
  title: {
    fontFamily: Font.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "300" as const,
  },
  section: {
    fontFamily: Font.serif,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "300" as const,
  },
  numeralXL: {
    fontFamily: Font.serif,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "300" as const,
    fontVariant: ["tabular-nums" as const],
  },
  numeralM: {
    fontFamily: Font.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "300" as const,
    fontVariant: ["tabular-nums" as const],
  },

  // Sans roles (never above 20px)
  body: {
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  rowTitle: {
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500" as const,
  },
  meta: {
    fontFamily: Font.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  eyebrow: {
    fontFamily: Font.sans,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    fontWeight: "600" as const,
  },
  button: {
    fontFamily: Font.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
  input: {
    fontFamily: Font.sans,
    fontSize: 17,
    fontWeight: "400" as const,
  },

  // Backward compatibility aliases
  titleSm: {
    fontFamily: Font.serif,
    fontSize: 22,
    fontWeight: "300" as const,
    lineHeight: 28,
  },
  caption: {
    fontFamily: Font.sans,
    fontSize: 13,
    lineHeight: 16,
  },
  numeral: {
    fontFamily: Font.serif,
    fontVariant: ["tabular-nums" as const],
  },
};
