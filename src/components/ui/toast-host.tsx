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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Font } from "@/constants/design";
import { N } from "@/constants/nourish-theme";
import { dismissToast, useToast } from "@/utils/toast";

function useGuardedInsets() {
  try {
    const insets = useSafeAreaInsets();
    return insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export function ToastHost() {
  const toast = useToast();
  const insets = useGuardedInsets();
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
      const total = currentToastRef.current?.duration ?? 4000;
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

    const duration = toast.duration ?? (toast.variant === "undo" ? 5000 : 4000);
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
  const isError = toast.variant === "error";
  const isSuccess = toast.variant === "success";

  const borderColor = isError
    ? "rgba(200, 99, 75, 0.45)"
    : isSuccess
      ? "rgba(76, 154, 106, 0.45)"
      : N.line;

  const dotColor = isError ? N.bad : isSuccess ? N.ok : "#d4a24c";
  const bottomOffset = Math.max(16, insets.bottom) + 64;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          bottom: bottomOffset,
          borderColor,
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
      <View style={styles.cardRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.text} numberOfLines={2}>
          {toast.message}
        </Text>

        {isUndo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={handleUndo}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        ) : toast.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            onPress={() => {
              dismissCurrent();
              void toast.action?.onPress();
            }}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: isError ? N.bad : N.acc },
              ]}
            >
              {toast.action.label}
            </Text>
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
    left: 16,
    right: 16,
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: N.card,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 9999,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cardRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flex: 1,
    color: N.ink,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  actionButton: {
    minWidth: 44,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  undoButtonText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "700",
    color: "#d4a24c",
  },
  actionButtonText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "700",
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