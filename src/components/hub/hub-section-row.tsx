import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { GymColors, Spacing, Typography } from "@/constants/theme";

type HubSectionRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function HubSectionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: HubSectionRowProps) {
  return (
    <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={styles.row}
  >
      <View style={styles.iconContainer}>
        <Icon size={20} color={GymColors.text.primary} />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    backgroundColor: GymColors.background.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },

  subtitle: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
    marginTop: Spacing.half,
  },

  chevron: {
    color: GymColors.text.tertiary,
    fontSize: 24,
  },
});