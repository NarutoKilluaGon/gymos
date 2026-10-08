import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  children?: React.ReactNode;
  haptic?: boolean;
  activeScale?: number;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...rest}
    >
      <Animated.View
        style={[
          style,
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
