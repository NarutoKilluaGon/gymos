import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Font } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.mute }]}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.actionContainer}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontFamily: Font.serif,
    fontSize: 20,
    fontWeight: "300",
    textAlign: "center",
    marginBottom: 6,
  },
  description: {
    fontFamily: Font.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  actionContainer: {
    marginTop: 16,
  },
});
