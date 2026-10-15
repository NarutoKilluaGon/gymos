import { ArrowUp } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
  ViewStyle,
} from "react-native";
import { Q } from "@/constants/quiet";
import { PressableScale } from "./pressable-scale";

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  busy?: boolean;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Composer({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Log anything: 2 rotis, dal, paneer bhurji",
  busy = false,
  accentColor = Q.accent.sage,
  style,
  testID,
}: ComposerProps) {
  const canSubmit = value.trim().length > 0 && !busy;

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS === "web" && (e.nativeEvent as any).key === "Enter" && !(e.nativeEvent as any).shiftKey) {
      e.preventDefault?.();
      if (canSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: `${accentColor}66`,
        },
        style,
      ]}
      testID={testID}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Q.color.mute}
        multiline
        onKeyPress={handleKeyPress}
        style={styles.input}
        returnKeyType="default"
        autoCapitalize="sentences"
      />

      <PressableScale
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Submit log"
        style={[
          styles.sendButton,
          canSubmit ? styles.sendButtonActive : styles.sendButtonDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={Q.color.bg} />
        ) : (
          <ArrowUp
            size={18}
            strokeWidth={2.5}
            color={canSubmit ? Q.color.bg : Q.color.mute}
          />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: Q.color.surface,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 104,
    fontFamily: Q.font.sansRegular,
    fontSize: 15,
    color: Q.color.ink,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: {
    backgroundColor: Q.color.ink,
  },
  sendButtonDisabled: {
    backgroundColor: Q.color.surface2,
  },
});
