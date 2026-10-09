import { Check, RotateCcw } from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Font } from "@/constants/design";
import { F } from "@/constants/forge-theme";
import { tap } from "@/components/workouts/forge-ui";
import { formatClock } from "@/services/forge/timing";

type BottomBarProps = {
  finished: boolean;
  counts: { done: number; total: number };
  restLeft: number;
  onFinishPress: () => void;
  onReopenPress: () => void;
  onAddRestSeconds: (seconds: number) => void;
  onSkipRest: () => void;
};

export function BottomBar({
  finished,
  counts,
  restLeft,
  onFinishPress,
  onReopenPress,
  onAddRestSeconds,
  onSkipRest,
}: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const showRest = restLeft > 0 && !finished;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: showRest ? 1 : 0,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [showRest, slideAnim]);

  return (
    <View style={styles.container}>
      {/* 1. REST TIMER PILL (floats above the bar with slide-up) */}
      {showRest ? (
        <Animated.View
          style={[
            styles.restPill,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.restClock}>
            {`Rest ${formatClock(restLeft * 1000)}`}
          </Text>

          <View style={styles.restActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="+15 seconds rest"
              onPress={() => onAddRestSeconds(15)}
              style={styles.restBtn}
            >
              <Text style={styles.restBtnText}>+15s</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip rest"
              onPress={onSkipRest}
              style={styles.restBtn}
            >
              <Text style={styles.restBtnText}>Skip</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* 2. DOCKED BAR CONTENT */}
      <View
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(12, insets.bottom),
          },
        ]}
      >
        {finished ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reopen"
            onPress={() => {
              tap();
              onReopenPress();
            }}
            style={styles.reopenButton}
          >
            <RotateCcw size={18} color={F.ink} />
            <Text style={styles.reopenButtonText}>Reopen</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Finish"
            onPress={() => {
              tap();
              onFinishPress();
            }}
            style={styles.finishButton}
          >
            <Check size={20} strokeWidth={2.5} color={F.accInk} />
            <Text style={styles.finishButtonText}>Finish</Text>
            <Text style={styles.finishCountText}>
              {` (${counts.done}/${counts.total})`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  restPill: {
    alignSelf: "center",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: F.card2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: F.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  restClock: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "600",
    color: F.ink,
    fontVariant: ["tabular-nums"],
  },
  restActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  restBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: F.card,
  },
  restBtnText: {
    fontFamily: Font.sans,
    fontSize: 13,
    fontWeight: "600",
    color: F.acc,
  },
  bar: {
    backgroundColor: F.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: F.line,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  finishButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: F.acc,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  finishButtonText: {
    fontFamily: Font.sans,
    fontSize: 16,
    fontWeight: "700",
    color: F.accInk,
  },
  finishCountText: {
    fontFamily: Font.sans,
    fontSize: 14,
    fontWeight: "600",
    color: F.accInk,
    opacity: 0.85,
  },
  reopenButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: F.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: F.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  reopenButtonText: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "600",
    color: F.ink,
  },
});
