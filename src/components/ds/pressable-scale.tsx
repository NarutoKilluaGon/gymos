import React, { useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { hapticLight } from "@/utils/haptics";

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  children?: React.ReactNode;
  haptic?: boolean;
  activeScale?: number;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

const LAYOUT_STYLE_KEYS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "margin",
  "marginHorizontal",
  "marginVertical",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginStart",
  "marginEnd",
  "position",
  "top",
  "bottom",
  "left",
  "right",
  "start",
  "end",
  "zIndex",
]);

export function PressableScale({
  children,
  haptic = true,
  activeScale = 0.97,
  activeOpacity = 0.9,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const { outerStyle, innerStyle } = useMemo(() => {
    const flattened = StyleSheet.flatten(style) as Record<string, any> | undefined;
    if (!flattened) return { outerStyle: undefined, innerStyle: undefined };

    const outer: Record<string, any> = {};
    const inner: Record<string, any> = {};

    for (const [key, value] of Object.entries(flattened)) {
      if (LAYOUT_STYLE_KEYS.has(key)) {
        outer[key] = value;
      } else {
        inner[key] = value;
      }
    }

    return { outerStyle: outer, innerStyle: inner };
  }, [style]);

  function handlePressIn(e: any) {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: activeScale,
          useNativeDriver: true,
          speed: 60,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: activeOpacity,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPressIn?.(e);
  }

  function handlePressOut(e: any) {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 60,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPressOut?.(e);
  }

  function handlePress(e: any) {
    if (disabled) return;
    if (haptic) {
      void hapticLight();
    }
    onPress?.(e);
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={outerStyle}
      {...rest}
    >
      <Animated.View
        style={[
          innerStyle,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
