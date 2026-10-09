import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/contexts/theme-context";

type SkeletonProps = {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = "100%",
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.card2,
          opacity,
        },
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
