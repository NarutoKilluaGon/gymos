import { Easing } from "react-native-reanimated";

import { Motion } from "@/constants/theme";

/**
 * Timing configs matching the vision's motion philosophy:
 * Fast (150ms) for small interactions,
 * Medium (250ms) for screen transitions,
 * Slow (350ms) for large state changes.
 * Easing.out(cubic) decelerates — the Material/iOS standard.
 */
export const TimingConfig = {
  fast: {
    duration: Motion.fast,
    easing: Easing.out(Easing.cubic),
  },
  medium: {
    duration: Motion.medium,
    easing: Easing.out(Easing.cubic),
  },
  slow: {
    duration: Motion.slow,
    easing: Easing.out(Easing.cubic),
  },
} as const;

/**
 * Spring config for responsive, tactile interactions.
 */
export const SpringConfig = {
  responsive: {
    damping: 18,
    stiffness: 220,
    mass: 0.8,
  },
} as const;