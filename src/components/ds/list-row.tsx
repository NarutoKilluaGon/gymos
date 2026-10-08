import { ChevronRight } from "lucide-react-native";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Font, Metric } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "./pressable-scale";

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  separator?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  icon,
  trailing,
  showChevron = false,
  destructive = false,
  onPress,
  separator = true,
  style,
  testID,
}: ListRowProps) {
  const theme = useTheme();

  const titleColor = destructive ? theme.bad : theme.ink;

  const content = (
    <View
      style={[
        styles.row,
        separator && { borderBottomWidth: 1, borderBottomColor: theme.line },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}

      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mute }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? (
        <View style={styles.trailingContainer}>{trailing}</View>
      ) : showChevron ? (
        <ChevronRight size={18} strokeWidth={1.75} color={theme.mute} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        onPress={onPress}
      >
        {content}
      </PressableScale>
    );
  }

  return <View testID={testID}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: Metric.listRowHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  iconContainer: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "500",
  },
  subtitle: {
    fontFamily: Font.sans,
    fontSize: 13,
    marginTop: 2,
  },
  trailingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
