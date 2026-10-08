import type { ReactNode } from "react";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";

import { TimingConfig } from "@/utils/motion";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
};

/**
 * Fades children in on mount using staggered entry motion.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = TimingConfig.medium.duration,
}: FadeInProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(duration).delay(delay)}
    >
      {children}
    </Animated.View>
  );
}