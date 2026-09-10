import type { ReactNode } from "react";
import Animated, {
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

import { TimingConfig } from "@/utils/motion";

type SlideUpProps = {
  children: ReactNode;
  visible: boolean;
};

/**
 * Slides children up into view when visible becomes true,
 * and down out of view when it becomes false.
 * Uses Motion medium for enter, fast for exit.
 */
export function SlideUp({ children, visible }: SlideUpProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.duration(
        TimingConfig.medium.duration,
      )}
      exiting={SlideOutDown.duration(
        TimingConfig.fast.duration,
      )}
    >
      {children}
    </Animated.View>
  );
}