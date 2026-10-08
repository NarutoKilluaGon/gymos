import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { Field } from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import { round1 } from "@/services/forge/load";

export type DraftRegistry = {
  register: (commit: () => void) => () => void;
  flushAll: () => void;
};

export function createDraftRegistry(): DraftRegistry {
  const fields = new Set<() => void>();

  return {
    register: (commit) => {
      fields.add(commit);

      return () => {
        fields.delete(commit);
      };
    },
    flushAll: () => {
      for (const commit of [...fields]) commit();
    },
  };
}

export const DraftContext = createContext<DraftRegistry | null>(null);

export const DraftScope = DraftContext.Provider;

export function NumberField({
  value,
  placeholder,
  decimal,
  label,
  onCommit,
}: {
  value: number | undefined;
  placeholder: string;
  decimal?: boolean;
  label: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const decimalRef = useRef(decimal);
  const registry = useContext(DraftContext);
  const shown = draft ?? (value ? String(round1(value)) : "");

  useEffect(() => {
    onCommitRef.current = onCommit;
    decimalRef.current = decimal;
  });

  const commit = useCallback(() => {
    const text = draftRef.current;

    if (text === null) return;

    draftRef.current = null;
    setDraft(null);

    const parsed = Number(text.replace(",", "."));

    if (text.trim() === "") {
      onCommitRef.current(0);
    } else if (Number.isFinite(parsed)) {
      onCommitRef.current(decimalRef.current ? parsed : Math.max(0, Math.round(parsed)));
    }
  }, []);

  useEffect(() => registry?.register(commit), [registry, commit]);
  useEffect(() => commit, [commit]);

  return (
    <TextInput
      accessibilityLabel={label}
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={F.dim}
      selectionColor={F.acc}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      onChangeText={(text) => {
        draftRef.current = text;
        setDraft(text);
      }}
      onBlur={commit}
      onEndEditing={commit}
      selectTextOnFocus
      style={styles.numberInput}
    />
  );
}

export function DraftTextField({
  value,
  onCommit,
  heading,
  ...input
}: Omit<
  TextInputProps,
  "value" | "defaultValue" | "onChangeText" | "onBlur" | "onEndEditing"
> & {
  value: string;
  onCommit: (text: string) => void;
  heading?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const registry = useContext(DraftContext);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const commit = useCallback(() => {
    const text = draftRef.current;

    if (text === null) return;

    draftRef.current = null;
    setDraft(null);
    onCommitRef.current(text);
  }, []);

  useEffect(() => registry?.register(commit), [registry, commit]);
  useEffect(() => commit, [commit]);

  const props: TextInputProps = {
    ...input,
    value: draft ?? value,
    onChangeText: (text) => {
      draftRef.current = text;
      setDraft(text);
    },
    onBlur: commit,
    onEndEditing: commit,
  };

  return heading ? <Field label={heading} {...props} /> : <TextInput {...props} />;
}

const styles = StyleSheet.create({
  numberInput: {
    width: 68,
    height: 48,
    borderRadius: 14,
    backgroundColor: F.card2,
    borderWidth: 1,
    borderColor: F.line,
    color: F.ink,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "500",
  },
});
