import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Card } from "@/components/ds/card";
import { Button as DSButton } from "@/components/ds/button";
import { Chip } from "@/components/ds/chip";
import { Seg as DSSeg } from "@/components/ds/seg";
import { Field as DSField } from "@/components/ds/field";
import { Bar as DSBar } from "@/components/ds/bar";
import { Sheet as DSSheet } from "@/components/ds/sheet";
import { Label as DSLabel } from "@/components/ds/typography";
import { N, NSerif } from "@/constants/nourish-theme";

export function tap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function NCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <Card tone="nourish" style={style}>{children}</Card>;
}

export const Label = DSLabel;

export function Pill({
  label,
  onPress,
  active,
  icon,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Chip
      label={label}
      onPress={onPress}
      active={active}
      icon={icon}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export const Seg = DSSeg;

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <DSButton
      label={label}
      onPress={onPress}
      kind={kind}
      disabled={disabled}
      busy={busy}
      style={style}
    />
  );
}

export const Field = DSField;

export const Bar = DSBar;

/** Calorie ring: `value` of `max`, turning red once over. */
export function Ring({
  value,
  max,
  size = 132,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  children?: ReactNode;
}) {
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const raw = max > 0 ? value / max : 0;
  const ratio = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  const over = max > 0 && value > max;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={N.card2}
          strokeWidth={stroke}
          fill="none"
        />
        {ratio > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={over ? N.bad : N.acc}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
      <View style={s.ringCenter}>{children}</View>
    </View>
  );
}

export const Sheet = DSSheet;

/** Whole number with thousands separators ("2,600"). */
export function fmtInt(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Number that renders as "-" while unknown. */
export function fmt(value: number, digits = 0): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "–";
}

export const text = StyleSheet.create({
  display: {
    fontFamily: NSerif,
    fontWeight: "300",
    color: N.ink,
  },
  body: { color: N.ink, fontSize: 15 },
  mute: { color: N.mute, fontSize: 13 },
});

const s = StyleSheet.create({
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
