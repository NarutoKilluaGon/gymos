import React from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { Font, Radius } from "@/constants/design";
import { useTheme } from "@/contexts/theme-context";
import { Label } from "./typography";

export function Field({
  label,
  style,
  ...input
}: TextInputProps & { label?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={theme.dim}
        selectionColor={theme.acc}
        {...input}
        style={[
          styles.input,
          {
            backgroundColor: theme.card2,
            borderColor: theme.line,
            color: theme.ink,
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
    borderRadius: Radius.control,
    borderWidth: 1,
    fontFamily: Font.sans,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
