import type { ReactNode } from "react";
import Animated, {
  FadeIn as ReanimatedFadeIn,
} from "react-native-reanimated";

import { TimingConfig } from "@/utils/motion";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
};

/**
 * Fades children in on mount, using the Motion
 * medium timing by default.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = TimingConfig.medium.duration,
}: FadeInProps) {
  return (
    <Animated.View
      entering={ReanimatedFadeIn.duration(duration).delay(delay)}
    >
      {children}
    </Animated.View>
  );
}