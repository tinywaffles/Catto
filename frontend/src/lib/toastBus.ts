'use client';

// Lightweight module-level event bus for toast notifications.
// Any hook or component can call emitToast() — ToastNotifications subscribes.

export interface ToastMessage {
  id: string;
  title: string;
  source: string;
  severity: 'CRITICAL' | 'HIGH';
  link?: string;
}

type Listener = (msg: ToastMessage) => void;
const listeners = new Set<Listener>();

export function emitToast(msg: ToastMessage) {
  for (const l of listeners) l(msg);
}

export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
