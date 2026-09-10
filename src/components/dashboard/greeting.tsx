import { StyleSheet, Text } from "react-native";

import { GymColors, Spacing, Typography } from "@/constants/theme";

type GreetingProps = {
  /** Optional override for testing. Defaults to time-of-day greeting. */
  text?: string;
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function Greeting({ text }: GreetingProps) {
  return (
    <Text style={styles.text}>
      {text ?? getTimeGreeting()}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: GymColors.text.primary,
    fontSize: Typography.display,
    fontWeight: "700",
    marginBottom: Spacing.three,
  },
});
