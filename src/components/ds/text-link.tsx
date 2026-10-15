import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Q } from "@/constants/quiet";
import { PressableScale } from "./pressable-scale";

export type TextLinkProps = {
  label: string;
  onPress: () => void;
  showBullet?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function TextLink({
  label,
  onPress,
  showBullet = false,
  style,
  textStyle,
  testID,
}: TextLinkProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <PressableScale
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={styles.pressable}
      >
        <Text style={[styles.text, textStyle]}>{label}</Text>
      </PressableScale>

      {showBullet && <Text style={styles.bullet}>·</Text>}
    </View>
  );
}

export type TextLinkBarProps = {
  items: {
    label: string;
    onPress: () => void;
    testID?: string;
  }[];
  showBullets?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TextLinkBar({ items, showBullets = false, style }: TextLinkBarProps) {
  return (
    <View style={[styles.bar, style]}>
      {items.map((item, index) => (
        <TextLink
          key={item.label}
          label={item.label}
          onPress={item.onPress}
          showBullet={showBullets && index < items.length - 1}
          testID={item.testID}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 18,
    flexWrap: "wrap",
    paddingVertical: 0,
  },
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  pressable: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  text: {
    fontFamily: Q.font.sansSemiBold,
    fontSize: 14,
    fontWeight: "600",
    color: Q.color.ink,
  },
  bullet: {
    fontFamily: Q.font.sansRegular,
    fontSize: 14,
    color: Q.color.mute,
    paddingHorizontal: 6,
  },
});
