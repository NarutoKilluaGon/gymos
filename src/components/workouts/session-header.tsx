import * as Haptics from "expo-haptics";
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { F, FSerif } from "@/constants/forge-theme";

type SessionHeaderProps = {
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onOptionsPress: () => void;
};

export function SessionHeader({
  name,
  onNameChange,
  onClose,
  onOptionsPress,
}: SessionHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onClose();
        }}
        style={styles.iconButton}
      >
        <ChevronLeft size={22} color={F.ink} />
      </Pressable>

      <View style={styles.titleContainer}>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          style={styles.titleInput}
          placeholder="Workout name"
          placeholderTextColor={F.dim}
          selectionColor={F.acc}
          accessibilityLabel="Workout name"
          selectTextOnFocus
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Workout options"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOptionsPress();
        }}
        style={styles.iconButton}
      >
        <MoreHorizontal size={20} color={F.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  titleInput: {
    color: F.ink,
    fontSize: 20,
    fontFamily: FSerif,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: "100%",
  },
});
