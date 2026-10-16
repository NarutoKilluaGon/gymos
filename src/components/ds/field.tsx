import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { Q } from "@/constants/quiet";
import { useTheme } from "@/contexts/theme-context";
import { Label } from "./typography";

export function Field({
  label,
  style,
  ...input
}: TextInputProps & { label?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={Q.color.mute}
        selectionColor={theme.acc}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            borderColor: focused ? theme.acc : Q.color.lineStrong,
            color: Q.color.ink,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 56,
    fontFamily: Q.font.sansRegular,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
