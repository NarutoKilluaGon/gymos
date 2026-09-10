import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  useAnimatedValue,
} from "react-native";

import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { dismissToast, useToast } from "@/utils/toast";

export function ToastHost() {
  const toast = useToast();
  const fadeAnim = useAnimatedValue(0);
  const prevId = useRef<number | null>(null);

  useEffect(() => {
    if (toast === null) {
      if (prevId.current !== null) {
        prevId.current = null;
      }
      return;
    }

    if (prevId.current === toast.id) {
      return;
    }

    prevId.current = toast.id;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => dismissToast(toast.id));
    }, 2600);

    return () => clearTimeout(timer);
  }, [toast, fadeAnim]);

  if (!toast) {
    return null;
  }

  const bgColor =
    toast.variant === "success"
      ? GymColors.semantic.accent
      : GymColors.semantic.error;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: bgColor },
        {
          opacity: fadeAnim,
          transform: [
            { translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0],
            })},
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: Spacing.four,
    right: Spacing.four,
    bottom: 112, // above tab bar
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: "center",
    zIndex: 9999,
  },
  text: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
});