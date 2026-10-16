import type { TextStyle } from "react-native";

/**
 * L · Quiet Design System Tokens
 *
 * Single source of truth for palette, typography, spacing, radii, hairlines,
 * and module accents across GymOS.
 */

export const Q = {
  color: {
    bg: "#141311",
    ink: "#F2EEE6",
    mute: "#8F8A80",
    line: "#2B2924",
    lineStrong: "#3A3731",
    surface: "#1B1A17",
    surface2: "#23211D",
    card: "#141311",
    scrim: "rgba(0, 0, 0, 0.6)",
  },

  accent: {
    brass: "#C9A25A", // Home, Hub, streaks, badges, primary CTA on Home
    ember: "#F0A04B", // Forge / Workouts, active workout CTA, timer, set pills
    sage: "#8CC5A2", // Nourish / Nutrition, logged meals, calorie progress
    periwinkle: "#93A9F2", // Move / Steps
    cyan: "#6CC4D8", // Water
    red: "#E5534B", // Over budget only, destructive actions, errors
  },

  font: {
    displayRegular: "FunnelDisplay-Regular",
    displayMedium: "FunnelDisplay-Medium",
    displaySemiBold: "FunnelDisplay-SemiBold",
    sansRegular: "FunnelSans-Regular",
    sansMedium: "FunnelSans-Medium",
    sansSemiBold: "FunnelSans-SemiBold",
  },

  type: {
    display: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: "500" as const,
      fontFamily: "FunnelDisplay-Medium",
      letterSpacing: -0.5,
    },
    titleLarge: {
      fontSize: 22,
      lineHeight: 26,
      fontWeight: "500" as const,
      fontFamily: "FunnelDisplay-Medium",
      letterSpacing: -0.3,
    },
    title: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "500" as const,
      fontFamily: "FunnelDisplay-Medium",
      letterSpacing: -0.2,
    },
    bodyLarge: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "400" as const,
      fontFamily: "FunnelSans-Regular",
      letterSpacing: 0,
    },
    body: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "400" as const,
      fontFamily: "FunnelSans-Regular",
      letterSpacing: 0,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "500" as const,
      fontFamily: "FunnelSans-Medium",
      letterSpacing: 0,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "400" as const,
      fontFamily: "FunnelSans-Regular",
      letterSpacing: 0.1,
    },
    captionMedium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500" as const,
      fontFamily: "FunnelSans-Medium",
      letterSpacing: 0.1,
    },
    micro: {
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "500" as const,
      fontFamily: "FunnelSans-Medium",
      letterSpacing: 0.2,
    },
    numDisplay: {
      fontSize: 38,
      lineHeight: 42,
      fontWeight: "600" as const,
      fontFamily: "FunnelDisplay-SemiBold",
      letterSpacing: -1,
      fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
    },
    numLarge: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "600" as const,
      fontFamily: "FunnelDisplay-SemiBold",
      letterSpacing: -0.5,
      fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
    },
    numMedium: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "600" as const,
      fontFamily: "FunnelDisplay-SemiBold",
      letterSpacing: -0.2,
      fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
    },
    numSmall: {
      fontSize: 13,
      lineHeight: 16,
      fontWeight: "600" as const,
      fontFamily: "FunnelDisplay-SemiBold",
      letterSpacing: 0,
      fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
    },
  },

  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },

  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  line: {
    hair: 1,
    regular: 1.5,
    strong: 2,
  },

  surface: {
    bg: "#141311",
    card: "#141311",
    surface: "#1B1A17",
    surface2: "#23211D",
  },

  elevation: {
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
} as const;

export type QuietTokens = typeof Q;

/** 1px outline colour for accent-owned controls (accent at ~40% alpha). */
export function accentOutline(color: string): string {
  return `${color}66`;
}
