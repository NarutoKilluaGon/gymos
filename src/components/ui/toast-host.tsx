import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Font } from "@/constants/design";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { dismissToast, useToast } from "@/utils/toast";

export function ToastHost() {
  const toast = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;

  const [reducedMotion, setReducedMotion] = useState(false);

  const prevId = useRef<number | null>(null);
  const remainingMsRef = useRef<number>(5000);
  const startTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoneRef = useRef<boolean>(false);
  const currentToastRef = useRef(toast);
  currentToastRef.current = toast;

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    let active = true;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        ?.then((enabled) => {
          if (active) setReducedMotion(enabled);
        })
        ?.catch(() => {});

      const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (enabled) => {
        if (active) setReducedMotion(enabled);
      });
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

  const dismissCurrent = useCallback(() => {
    const t = currentToastRef.current;
    if (!t) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      if (currentToastRef.current?.id === t.id) {
        dismissToast(t.id);
      }
    });
  }, [fadeAnim]);

  const startCountdown = useCallback(
    (durationMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      startTimeRef.current = Date.now();

      if (!reducedMotion) {
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      }

      timerRef.current = setTimeout(() => {
        dismissCurrent();
      }, durationMs);
    },
    [dismissCurrent, progressAnim, reducedMotion],
  );

  const pauseTimer = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    progressAnim.stopAnimation((val) => {
      const total = currentToastRef.current?.duration ?? 5000;
      remainingMsRef.current = Math.max(0, val * total);
    });
  }, [progressAnim]);

  const resumeTimer = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    if (remainingMsRef.current > 0) {
      startCountdown(remainingMsRef.current);
    } else {
      dismissCurrent();
    }
  }, [dismissCurrent, startCountdown]);

  const handleUndo = useCallback(() => {
    if (undoneRef.current) return;
    undoneRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    progressAnim.stopAnimation();

    const t = currentToastRef.current;
    dismissCurrent();

    if (t?.onUndo) {
      void t.onUndo();
    }
  }, [dismissCurrent, progressAnim]);

  // PanResponder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 30,
      onPanResponderGrant: () => {
        pauseTimer();
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 60 || Math.abs(gestureState.vx) > 0.5) {
          Animated.timing(panX, {
            toValue: gestureState.dx > 0 ? 400 : -400,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            dismissCurrent();
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start(() => {
            resumeTimer();
          });
        }
      },
      onPanResponderTerminate: () => {
        resumeTimer();
      },
    }),
  ).current;

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
    undoneRef.current = false;
    isPausedRef.current = false;
    panX.setValue(0);
    fadeAnim.setValue(0);
    progressAnim.setValue(1);

    const duration = toast.duration ?? (toast.variant === "undo" ? 5000 : 2600);
    remainingMsRef.current = duration;

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    startCountdown(duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, fadeAnim, panX, progressAnim, startCountdown]);

  if (!toast) {
    return null;
  }

  const isUndo = toast.variant === "undo";
  const bgColor = isUndo
    ? "#1a1e1b"
    : toast.variant === "success"
      ? GymColors.semantic.accent
      : GymColors.semantic.error;

  return (
    <Animated.View
      style={[
        styles.toast,
        isUndo && styles.undoToast,
        { backgroundColor: bgColor },
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
            { translateX: panX },
          ],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityActions={isUndo ? [{ name: "undo", label: "Undo" }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "undo") {
          handleUndo();
        }
      }}
      onTouchStart={pauseTimer}
      onTouchEnd={resumeTimer}
      {...panResponder.panHandlers}
    >
      <View style={isUndo ? styles.undoRow : styles.normalRow}>
        <Text style={[styles.text, isUndo && styles.undoText]} numberOfLines={2}>
          {toast.message}
        </Text>

        {isUndo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={handleUndo}
            style={styles.undoButton}
            hitSlop={8}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        ) : null}
      </View>

      {isUndo ? (
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                transform: [{ scaleX: progressAnim }],
              },
            ]}
          />
        </View>
      ) : null}
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
    justifyContent: "center",
    zIndex: 9999,
  },
  undoToast: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  normalRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  undoRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingLeft: Spacing.two,
  },
  text: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
  undoText: {
    flex: 1,
    textAlign: "left",
    fontSize: 14,
    fontWeight: "500",
    color: "#ece8df",
  },
  undoButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  undoButtonText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "700",
    color: "#d4a24c",
  },
  barTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  barFill: {
    height: 2,
    width: "100%",
    backgroundColor: "#d4a24c",
    transformOrigin: "left",
  },
});