import React from "react";
import {
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Gutter } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export type ScreenProps = {
  children: React.ReactNode;
  /** When false, renders a non-scrolling View root (for Forge session). Defaults to true. */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Bottom padding to clear tab bar / docked bar / inset. Defaults to 96. */
  bottomPadding?: number;
  /** Optional floating element (e.g. FAB) pinned over the scrolling screen. */
  floating?: React.ReactNode;
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: "handled" | "always" | "never";
  testID?: string;
};

function useGuardedInsets() {
  try {
    const insets = useSafeAreaInsets();
    return insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export function Screen({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  bottomPadding = 96,
  floating,
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps = "handled",
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useGuardedInsets();

  const isWeb = Platform.OS === "web";
  const webWrapperStyle = isWeb
    ? { maxWidth: 800, width: "100%" as const, alignSelf: "center" as const }
    : undefined;

  const bottomInset = (insets.bottom || 0) + bottomPadding;

  if (!scroll) {
    return (
      <View
        testID={testID}
        style={[
          styles.root,
          {
            backgroundColor: theme.bg,
            paddingTop: insets.top || 0,
            paddingBottom: insets.bottom || 0,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <View style={[styles.innerFixed, { paddingTop: 12 }, webWrapperStyle]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top || 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          webWrapperStyle,
          {
            paddingTop: 12,
            paddingBottom: bottomInset,
            paddingHorizontal: Gutter,
          },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      >
        {children}
      </ScrollView>
      {floating}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  innerFixed: {
    flex: 1,
    paddingHorizontal: Gutter,
  },
});
