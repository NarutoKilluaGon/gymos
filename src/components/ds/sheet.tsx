import { X } from "lucide-react-native";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Font, Radius } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { IconButton } from "./icon-button";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  destructiveSection?: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
};

function useGuardedInsets() {
  try {
    const insets = useSafeAreaInsets();
    return insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  destructiveSection,
  footer,
  style,
  contentContainerStyle,
  scroll = true,
}: SheetProps) {
  const theme = useTheme();
  const insets = useGuardedInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={onClose}
        />

        <View
          style={[
            styles.pane,
            {
              backgroundColor: theme.bg,
              borderColor: theme.line,
              paddingBottom: (insets.bottom || 0) + 16,
            },
            style,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />

          <View style={styles.headerRow}>
            {title ? (
              <Text style={[styles.title, { color: theme.ink }]}>
                {title}
              </Text>
            ) : (
              <View style={styles.spacer} />
            )}

            <IconButton
              icon={<X size={20} strokeWidth={1.75} color={theme.ink} />}
              onPress={onClose}
              accessibilityLabel="Close sheet"
            />
          </View>

          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, contentContainerStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, contentContainerStyle]}>
              {children}
            </View>
          )}

          {destructiveSection ? (
            <View style={[styles.destructiveSection, { borderTopColor: theme.line }]}>
              {destructiveSection}
            </View>
          ) : null}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  pane: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "88%",
    paddingTop: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    minHeight: 48,
  },
  spacer: {
    flex: 1,
  },
  title: {
    flex: 1,
    fontFamily: Font.serif,
    fontSize: 22,
    fontWeight: "300",
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  destructiveSection: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
