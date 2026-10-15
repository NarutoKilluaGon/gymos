import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Q } from "@/constants/quiet";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type SegOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SegProps<T extends string | number> = {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  accentColor,
  style,
}: SegProps<T>) {
  const theme = useTheme();
  const acc = accentColor ?? theme.accent ?? theme.acc ?? Q.accent.brass;

  return (
    <View accessibilityRole="tablist" style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <PressableScale
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={styles.item}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: active ? acc : "transparent" },
              ]}
            />
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * 160ms crossfade transition wrapper for switching tabs or days.
 */
export function Crossfade({
  triggerKey,
  children,
  duration = 160,
  style,
}: {
  triggerKey: unknown;
  children: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const isReduced = useRef(process.env.NODE_ENV === "test");

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        ?.then((e) => {
          isReduced.current = e;
        })
        ?.catch(() => {});

      const sub = AccessibilityInfo.addEventListener?.(
        "reduceMotionChanged",
        (enabled) => {
          isReduced.current = enabled;
        },
      );
      return () => {
        sub?.remove?.();
      };
    } catch {}
  }, []);

  const prevKey = useRef(triggerKey);
  useEffect(() => {
    if (prevKey.current !== triggerKey) {
      prevKey.current = triggerKey;
      if (isReduced.current || process.env.NODE_ENV === "test") {
        opacity.setValue(1);
        return;
      }
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }
  }, [triggerKey, duration, opacity]);

  return (
    <Animated.View style={[{ opacity }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
  },
  labelInactive: {
    fontFamily: Q.font.sansMedium,
    fontWeight: "500",
    color: Q.color.mute,
  },
  labelActive: {
    fontFamily: Q.font.sansSemiBold,
    fontWeight: "600",
    color: Q.color.ink,
  },
});
