import "@/global.css";

import { Platform } from "react-native";
import { HOME } from "@/constants/design";
import { Q } from "@/constants/quiet";

/**
 * GymOS design tokens.
 * @deprecated Use Q from '@/constants/quiet' or Theme from '@/constants/design' instead.
 */
export const GymColors = {
  background: {
    primary: HOME.bg,
    card: HOME.card,
    surface: HOME.card2,
  },

  text: {
    primary: HOME.ink,
    secondary: HOME.mute,
    tertiary: HOME.dim,
    disabled: HOME.dim,
  },

  semantic: {
    success: HOME.ok,
    warning: HOME.warn,
    error: HOME.bad,
    accent: HOME.acc,
  },
} as const;

export const Fonts = {
  sans: Q.font.sansRegular,
  serif: Q.font.displayMedium,
  rounded: Q.font.sansMedium,
  mono: "monospace",
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 40,
  seven: 48,
  eight: 64,
} as const;

export const Radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
  small: 4,
  medium: 8,
  large: 12,
  extraLarge: 16,
} as const;

export const Typography = {
  display: 32,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  caption: 13,
} as const;

export const Motion = {
  fast: 150,
  medium: 250,
  slow: 350,
} as const;

export const BottomTabInset =
  Platform.select({
    ios: 50,
    android: 80,
  }) ?? 0;

export const MaxContentWidth = 800;
