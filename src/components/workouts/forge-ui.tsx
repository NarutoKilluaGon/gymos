import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { Card } from "@/components/ds/card";
import { Button as DSButton } from "@/components/ds/button";
import { Chip } from "@/components/ds/chip";
import { Seg as DSSeg } from "@/components/ds/seg";
import { Field as DSField } from "@/components/ds/field";
import { Bar as DSBar } from "@/components/ds/bar";
import { Sheet as DSSheet } from "@/components/ds/sheet";
import { Label as DSLabel } from "@/components/ds/typography";
import { F, FSerif } from "@/constants/forge-theme";

export function tap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function FCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <Card tone="forge" style={style}>{children}</Card>;
}

export const Label = DSLabel;

export function Pill({
  label,
  onPress,
  active,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Chip
      label={label}
      onPress={onPress}
      active={active}
      icon={icon}
      disabled={disabled}
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
  kind?: "primary" | "secondary" | "ghost" | "danger";
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
    fontFamily: FSerif,
    fontWeight: "300",
    color: F.ink,
  },
  body: { color: F.ink, fontSize: 15 },
  mute: { color: F.mute, fontSize: 13 },
});
