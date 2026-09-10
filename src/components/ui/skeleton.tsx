import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { GymColors } from "@/constants/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: object;
};

/**
 * Pulsing placeholder used while content loads.
 * Prefer this over ActivityIndicator — it matches the
 * screen's real layout and feels intentional.
 */
export function Skeleton({
  width = "100%",
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius },
        styles.base,
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonList({
  count,
  height,
  gap = 12,
}: {
  count: number;
  height: number;
  gap?: number;
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: GymColors.background.surface,
  },
});