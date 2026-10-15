import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { Q } from "@/constants/quiet";

type HubSectionRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  trailing?: ReactNode;
};

export function HubSectionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
  trailing,
}: HubSectionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.iconContainer}>
        <Icon size={18} color={Q.color.mute} />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>

        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ?? <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    minHeight: 52,
  },

  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
  },

  title: {
    fontFamily: Q.font.sansMedium,
    color: Q.color.ink,
    fontSize: 16,
    fontWeight: "500",
  },

  subtitle: {
    fontFamily: Q.font.sansRegular,
    color: Q.color.mute,
    fontSize: 13,
    marginTop: 2,
  },

  chevron: {
    fontFamily: Q.font.sansRegular,
    color: Q.color.mute,
    fontSize: 18,
    lineHeight: 20,
  },
});