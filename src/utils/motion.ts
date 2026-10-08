import { Platform } from "react-native";
import {
  Easing,
  FadeInDown,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

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

/**
 * Staggered entrance animation for lists and stacked cards:
 * FadeInDown with 55ms stagger capped at 8 items (max 440ms delay).
 */
export function enter(index = 0) {
  const cappedIndex = Math.min(Math.max(0, index), 8);
  const delay = cappedIndex * 55;

  return FadeInDown.duration(260)
    .delay(delay)
    .easing(Easing.out(Easing.cubic));
}

/**
 * Layout transition for lists:
 * Spring-based on native platforms, smooth timing on web.
 */
export const listLayout =
  Platform.OS === "web"
    ? LinearTransition.duration(200).easing(Easing.out(Easing.cubic))
    : LinearTransition.springify().damping(18).stiffness(200);

export { useReducedMotion };