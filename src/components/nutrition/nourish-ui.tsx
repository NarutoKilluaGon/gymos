import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { N, NRadius, NSerif } from "@/constants/nourish-theme";

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
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        s.pill,
        active && s.pillActive,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      {icon}
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Segmented control. */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={[s.segItem, active && s.segItemActive]}
          >
            <Text style={[s.segText, active && s.segTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
  const off = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        kind === "primary" && s.buttonPrimary,
        kind === "ghost" && s.buttonGhost,
        kind === "danger" && s.buttonDanger,
        pressed && s.pressed,
        off && s.disabled,
        style,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          kind === "primary" ? { color: N.accInk } : { color: N.ink },
          kind === "danger" && { color: N.bad },
        ]}
      >
        {busy ? "Working…" : label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...input
}: TextInputProps & { label?: string }) {
  return (
    <View style={s.field}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={N.dim}
        selectionColor={N.acc}
        {...input}
        style={[s.input, style]}
      />
    </View>
  );
}

/** Horizontal progress bar. `value`/`max` clamp to the track. */
export function Bar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const raw = max > 0 ? value / max : 0;
  const ratio = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;

  return (
    <View style={[s.track, { height }]}>
      <View
        style={{
          width: `${ratio * 100}%`,
          height,
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

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
      </Svg>
      <View style={s.ringCenter}>{children}</View>
    </View>
  );
}

/** Bottom sheet. Backdrop tap and Android back both close it. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.sheetRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityLabel="Close"
          style={s.backdrop}
          onPress={onClose}
        />
        <View style={s.pane}>
          <View style={s.grabber} />
          {title ? <Text style={s.sheetTitle}>{title}</Text> : null}
          <ScrollView
            style={s.paneScroll}
            contentContainerStyle={s.paneContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  card: {
    backgroundColor: N.card,
    borderRadius: NRadius.card,
    borderWidth: 1,
    borderColor: N.line,
    padding: 16,
  },
  label: {
    color: N.mute,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: NRadius.pill,
    backgroundColor: N.card,
    borderWidth: 1,
    borderColor: N.line,
  },
  pillActive: { backgroundColor: N.acc, borderColor: N.acc },
  pillText: { color: N.ink, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: N.accInk },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  seg: {
    flexDirection: "row",
    backgroundColor: N.card,
    borderRadius: NRadius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: N.line,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: NRadius.pill,
  },
  segItemActive: { backgroundColor: N.acc },
  segText: { color: N.mute, fontSize: 13, fontWeight: "500" },
  segTextActive: { color: N.accInk },
  button: {
    minHeight: 48,
    borderRadius: NRadius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: N.acc },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: N.line,
  },
  buttonDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: N.bad,
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  field: { marginBottom: 12 },
  input: {
    backgroundColor: N.card2,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    color: N.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  track: {
    backgroundColor: N.card2,
    borderRadius: 6,
    overflow: "hidden",
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: N.scrim },
  pane: {
    backgroundColor: N.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: N.line,
    maxHeight: "88%",
    paddingTop: 8,
  },
  paneScroll: { flexGrow: 0 },
  paneContent: { paddingHorizontal: 20, paddingBottom: 12 },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: N.line,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: NSerif,
    fontWeight: "300",
    fontSize: 24,
    color: N.ink,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8,
  },
});
