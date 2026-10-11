import { useSyncExternalStore } from 'react';

/** Confirmations, action errors and toasts: plain functions that any handler can await, rendered by DialogHost. */
export type DialogRequest = { id: number } & (
  | {
      kind: 'confirm';
      title: string;
      message?: string;
      confirmLabel: string;
      tone: 'danger' | 'primary';
      resolve: (confirmed: boolean) => void;
    }
  | {
      kind: 'alert';
      title: string;
      message: string;
      resolve: () => void;
    }
);

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export interface Toast {
  id: number;
  message: string;
}

interface State {
  /** Requests wait their turn: only the first one is shown. */
  queue: DialogRequest[];
  toasts: Toast[];
}

const TOAST_MS = 4000;
let state: State = { queue: [], toasts: [] };
let nextToast = 0;
let nextRequest = 0;
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

function enqueue(request: DistributiveOmit<DialogRequest, 'id'>) {
  update({ queue: [...state.queue, { ...request, id: nextRequest++ }] });
}

/** Resolves true when the user confirms, false when they cancel, press Escape or click outside. */
export function confirm(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}) {
  return new Promise<boolean>((resolve) =>
    enqueue({
      kind: 'confirm',
      confirmLabel: 'Confirmer',
      tone: 'danger',
      ...options,
      resolve,
    }),
  );
}

/** Error after a click: resolves once the user has read it. */
export function alertDialog(options: { title?: string; message: string }) {
  return new Promise<void>((resolve) =>
    enqueue({
      kind: 'alert',
      title: options.title ?? 'Action impossible',
      message: options.message,
      resolve,
    }),
  );
}

/** Answers the first request and shows the next one. */
export function closeDialog() {
  update({ queue: state.queue.slice(1) });
}

export function toast(message: string) {
  const id = nextToast++;
  update({ toasts: [...state.toasts, { id, message }] });
  setTimeout(
    () => update({ toasts: state.toasts.filter((item) => item.id !== id) }),
    TOAST_MS,
  );
}

/** For tests: nothing left from the previous one. */
export function resetDialogs() {
  state = { queue: [], toasts: [] };
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

export function useDialogs() {
  const { queue, toasts } = useSyncExternalStore(subscribe, () => state);
  return { dialog: queue[0] as DialogRequest | undefined, toasts };
}
