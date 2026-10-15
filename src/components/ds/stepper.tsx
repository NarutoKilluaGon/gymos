import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Q } from "@/constants/quiet";
import { PressableScale } from "./pressable-scale";

export type StepperProps = {
  label: string;
  value: number | string;
  unit?: string;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Stepper({
  label,
  value,
  unit,
  onIncrement,
  onDecrement,
  style,
  testID,
}: StepperProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {value}
          {unit ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
      </View>

      <View style={styles.buttonsRow}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={onDecrement}
          style={styles.stepButton}
        >
          <Text style={styles.buttonText}>−</Text>
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={onIncrement}
          style={styles.stepButton}
        >
          <Text style={styles.buttonText}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontFamily: Q.font.sansRegular,
    fontSize: 13,
    color: Q.color.mute,
  },
  valueRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "baseline",
  },
  value: {
    fontFamily: Q.font.displayMedium,
    fontSize: 84,
    fontWeight: "500",
    color: Q.color.ink,
    letterSpacing: -3,
    lineHeight: 88,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontFamily: Q.font.sansRegular,
    fontSize: 18,
    color: Q.color.mute,
    letterSpacing: 0,
    fontWeight: "400",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  stepButton: {
    width: 52,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Q.color.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  buttonText: {
    fontFamily: Q.font.sansMedium,
    fontSize: 22,
    color: Q.color.ink,
    lineHeight: 24,
  },
});
