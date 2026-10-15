import { StyleSheet, Text } from "react-native";

import { Q } from "@/constants/quiet";

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
    color: Q.color.ink,
    fontFamily: Q.font.sansMedium,
    fontSize: 13,
    fontWeight: "600",
  },
});
