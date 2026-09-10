import { useEffect, useState } from "react";

export type ToastVariant = "error" | "success";

export type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastListener = (toast: ToastMessage | null) => void;

let current: ToastMessage | null = null;
let nextId = 1;
const listeners = new Set<ToastListener>();

function publish() {
  for (const listener of listeners) {
    listener(current);
  }
}

export function showToast(
  message: string,
  variant: ToastVariant = "error",
): void {
  current = { id: nextId++, message, variant };
  publish();
}

export function dismissToast(id: number): void {
  if (current?.id !== id) {
    return;
  }

  current = null;
  publish();
}

export function useToast(): ToastMessage | null {
  const [toast, setToast] = useState<ToastMessage | null>(current);

  useEffect(() => {
    listeners.add(setToast);

    return () => {
      listeners.delete(setToast);
    };
  }, []);

  return toast;
}