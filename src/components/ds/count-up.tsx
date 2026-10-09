import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
} from "react-native";

export type CountUpProps = {
  /** Target numeric value to count up to. */
  value: number;
  /** Starting value for the initial animation (defaults to 0). */
  initialValue?: number;
  /** Duration of animation in milliseconds (defaults to 500ms). */
  duration?: number;
  /** Custom formatter function. Default rounds to integer. */
  formatter?: (value: number) => string;
  /** Optional prefix (e.g. "+", "$"). */
  prefix?: string;
  /** Optional suffix (e.g. "g", " kcal"). */
  suffix?: string;
  /** Custom text styling. */
  style?: StyleProp<TextStyle>;
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  value,
  initialValue = 0,
  duration = 500,
  formatter = (v) => String(Math.round(v)),
  prefix = "",
  suffix = "",
  style,
}: CountUpProps) {
  const [animValue, setAnimValue] = useState<number>(() => {
    if (process.env.NODE_ENV === "test") return value;
    return initialValue;
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    return process.env.NODE_ENV === "test";
  });

  const prevValueRef = useRef(animValue);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    let active = true;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        ?.then((enabled) => {
          if (active) setReducedMotion(enabled);
        })
        ?.catch(() => {});

      const sub = AccessibilityInfo.addEventListener?.(
        "reduceMotionChanged",
        (enabled) => {
          if (active) setReducedMotion(enabled);
        },
      );
      return () => {
        active = false;
        sub?.remove?.();
      };
    } catch {
      return () => {
        active = false;
      };
    }
  }, []);

  useEffect(() => {
    if (reducedMotion || process.env.NODE_ENV === "test") {
      prevValueRef.current = value;
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const startTime = Date.now();

    const frame = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const current = startVal + (endVal - startVal) * eased;

      setAnimValue(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        prevValueRef.current = endVal;
        setAnimValue(endVal);
      }
    };

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [value, duration, reducedMotion]);

  const displayValue =
    reducedMotion || process.env.NODE_ENV === "test" ? value : animValue;

  const formatted = `${prefix}${formatter(displayValue)}${suffix}`;

  return (
    <Text
      style={[styles.tabular, style]}
      accessibilityLabel={`${prefix}${formatter(value)}${suffix}`}
    >
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
