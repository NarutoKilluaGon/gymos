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

import { F, FRadius, FSerif } from "@/constants/forge-theme";

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
          kind === "primary" ? { color: F.accInk } : { color: F.ink },
          kind === "danger" && { color: F.bad },
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
        placeholderTextColor={F.dim}
        selectionColor={F.acc}
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
    fontFamily: FSerif,
    fontWeight: "300",
    color: F.ink,
  },
  body: { color: F.ink, fontSize: 15 },
  mute: { color: F.mute, fontSize: 13 },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: F.card,
    borderRadius: FRadius.card,
    borderWidth: 1,
    borderColor: F.line,
    padding: 16,
  },
  label: {
    color: F.mute,
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
    borderRadius: FRadius.pill,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.line,
  },
  pillActive: { backgroundColor: F.ink, borderColor: F.ink },
  pillText: { color: F.ink, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: F.bg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  seg: {
    flexDirection: "row",
    backgroundColor: F.card,
    borderRadius: FRadius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: F.line,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: FRadius.pill,
  },
  segItemActive: { backgroundColor: F.ink },
  segText: { color: F.mute, fontSize: 13, fontWeight: "500" },
  segTextActive: { color: F.bg },
  button: {
    minHeight: 48,
    borderRadius: FRadius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: F.acc },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: F.line,
  },
  buttonDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: F.bad,
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  field: { marginBottom: 12 },
  input: {
    backgroundColor: F.card2,
    borderRadius: FRadius.control,
    borderWidth: 1,
    borderColor: F.line,
    color: F.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  track: {
    backgroundColor: F.card2,
    borderRadius: 6,
    overflow: "hidden",
  },
    sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: F.scrim },
  pane: {
    backgroundColor: F.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: F.line,
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
    backgroundColor: F.line,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FSerif,
    fontWeight: "300",
    fontSize: 24,
    color: F.ink,
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
