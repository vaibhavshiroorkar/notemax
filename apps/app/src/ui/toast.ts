import { createStore } from "@/platform/store";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run(): void };
}

/** Short messages at the bottom of the window, newest last. */
export const toasts = createStore<Toast[]>([]);

let nextId = 1;
// A few at once is plenty; older ones make room.
const MAX = 3;

/** Shows a message for a few seconds, with an optional button like Undo. */
export function showToast(message: string, action?: Toast["action"]): number {
  const toast = { id: nextId++, message, action };
  toasts.set([...toasts.get(), toast].slice(-MAX));
  return toast.id;
}

export function dismissToast(id: number) {
  toasts.set(toasts.get().filter((toast) => toast.id !== id));
}
