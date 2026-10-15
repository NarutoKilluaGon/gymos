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
import { ProgressLine } from "./progress-line";

export type ModuleRowAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  accentColor?: string;
};

export type ModuleRowProps = {
  title: string;
  accent: string;
  subtitle: string;
  action?: ModuleRowAction | React.ReactNode;
  progress?: {
    value: number;
    target: number;
    color?: string;
    overColor?: string;
    showTargetTick?: boolean;
  };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ModuleRow({
  title,
  accent,
  subtitle,
  action,
  progress,
  onPress,
  style,
  testID,
}: ModuleRowProps) {
  const isActionObj =
    Boolean(action && typeof action === "object" && "label" in action && typeof (action as any).onPress === "function");
  const actionObj = isActionObj ? (action as ModuleRowAction) : null;
  const customActionNode = !isActionObj && action ? (action as React.ReactNode) : null;

  const content = (
    <View style={[styles.container, style]} testID={testID}>
      {/* Top row: Module Dot + Title, Subtitle, and Action Button */}
      <View style={styles.topRow}>
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {customActionNode}

        {actionObj && (
          <PressableScale
            onPress={actionObj.onPress}
            style={[
              styles.actionButton,
              actionObj.variant === "primary"
                ? styles.actionPrimary
                : [
                    styles.actionOutline,
                    {
                      borderColor: actionObj.accentColor
                        ? `${actionObj.accentColor}66`
                        : `${accent}66`,
                    },
                  ],
            ]}
          >
            <Text
              style={[
                styles.actionText,
                actionObj.variant === "primary"
                  ? styles.actionTextPrimary
                  : {
                      color: actionObj.accentColor ?? accent,
                    },
              ]}
            >
              {actionObj.label}
            </Text>
          </PressableScale>
        )}
      </View>

      {/* Optional Progress Line */}
      {progress && (
        <View style={styles.progressRow}>
          <ProgressLine
            value={progress.value}
            target={progress.target}
            color={progress.color ?? accent}
            overColor={progress.overColor ?? Q.accent.red}
            showTargetTick={progress.showTargetTick}
            height={2}
          />
        </View>
      )}
    </View>
  );

  if (onPress && !action) {
    return (
      <PressableScale onPress={onPress}>
        {content}
      </PressableScale>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: Q.color.line,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textColumn: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontFamily: Q.font.displayMedium,
    fontSize: 21,
    fontWeight: "500",
    color: Q.color.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: Q.font.sansRegular,
    fontSize: 14,
    color: Q.color.mute,
    marginTop: 3,
    marginLeft: 17, // indent past 8px dot + 9px gap
    fontVariant: ["tabular-nums"],
  },
  actionButton: {
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  actionPrimary: {
    backgroundColor: Q.color.ink,
    paddingHorizontal: 16,
  },
  actionOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionText: {
    fontFamily: Q.font.sansMedium,
    fontSize: 14,
    fontWeight: "600",
  },
  actionTextPrimary: {
    color: Q.color.bg,
  },
  progressRow: {
    marginTop: 12,
  },
});
