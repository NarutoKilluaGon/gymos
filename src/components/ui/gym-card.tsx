import { StyleSheet, View, type ViewProps } from "react-native";
import { Q } from "@/constants/quiet";

export type GymCardProps = ViewProps;

export function GymCard({ style, ...otherProps }: GymCardProps) {
  return <View style={[styles.card, style]} {...otherProps} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Q.color.card,
    borderRadius: Q.radius.none,
    borderWidth: 1,
    borderColor: Q.color.line,
    padding: 16,
  },
});
