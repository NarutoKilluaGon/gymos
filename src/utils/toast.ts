import { useEffect, useState } from "react";

export type ToastVariant = "error" | "success" | "undo";

export type UndoToastOptions = {
  message: string;
  onUndo: () => void | Promise<void>;
  duration?: number;
};

export type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
  onUndo?: () => void | Promise<void>;
  duration?: number;
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
): number {
  const id = nextId++;
  current = { id, message, variant };
  publish();
  return id;
}

export function showUndoToast(options: UndoToastOptions): number {
  const id = nextId++;
  current = {
    id,
    message: options.message,
    variant: "undo",
    onUndo: options.onUndo,
    duration: options.duration ?? 5000,
  };
  publish();
  return id;
}

export function dismissToast(id: number): void {
  if (current?.id !== id) {
    return;
  }

  current = null;
  publish();
}

export function clearToast(): void {
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