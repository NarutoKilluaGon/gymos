import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Font, Metric, Radius } from "@/constants/design";
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
  style?: StyleProp<ViewStyle>;
};

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: SegProps<T>) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isReducedMotion = useRef(process.env.NODE_ENV === "test");

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        ?.then((enabled) => {
          isReducedMotion.current = enabled;
        })
        ?.catch(() => {});

      const sub = AccessibilityInfo.addEventListener?.(
        "reduceMotionChanged",
        (enabled) => {
          isReducedMotion.current = enabled;
        },
      );
      return () => {
        sub?.remove?.();
      };
    } catch {}
  }, []);

  const activeIndex = options.findIndex((o) => o.value === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const itemWidth =
    containerWidth > 6 && options.length > 0
      ? (containerWidth - 6) / options.length
      : 0;

  useEffect(() => {
    if (containerWidth <= 0 || itemWidth <= 0) return;
    const targetX = safeIndex * itemWidth;
    if (isReducedMotion.current || process.env.NODE_ENV === "test") {
      slideAnim.setValue(targetX);
    } else {
      Animated.timing(slideAnim, {
        toValue: targetX,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [safeIndex, itemWidth, containerWidth, slideAnim]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          backgroundColor: theme.card,
          borderColor: theme.line,
        },
        style,
      ]}
    >
      {containerWidth > 0 && itemWidth > 0 ? (
        <Animated.View
          style={[
            styles.slider,
            {
              width: itemWidth,
              backgroundColor: theme.card2,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const active = option.value === value;

        return (
          <PressableScale
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              (containerWidth === 0 || itemWidth === 0) &&
                active && [
                  styles.itemActive,
                  { backgroundColor: theme.card2 },
                ],
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.ink : theme.mute },
                active && styles.labelActive,
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
    position: "relative",
    flexDirection: "row",
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    alignItems: "center",
  },
  slider: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: Radius.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  item: {
    flex: 1,
    minHeight: Metric.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  itemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "500",
  },
  labelActive: {
    fontWeight: "600",
  },
});
