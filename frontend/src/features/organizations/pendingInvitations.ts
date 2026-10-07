import { useEffect, useSyncExternalStore } from 'react';
import { getInvitations } from './api.ts';

// Same pattern as the session store: a number shared by the navigation and the invitations page
let count = 0;
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

function set(value: number) {
  if (value === count) return;
  count = value;
  listeners.forEach((notify) => notify());
}

/** Asks the API how many invitations wait for an answer. A failure counts as none. */
export async function refreshPendingInvitations() {
  try {
    set((await getInvitations()).length);
  } catch {
    set(0);
  }
}

/** Number of pending invitations for the navigation badge; `enabled` is false for visitors and participants. */
export function usePendingInvitations(enabled: boolean) {
  const value = useSyncExternalStore(subscribe, () => count);

  useEffect(() => {
    if (enabled) void refreshPendingInvitations();
    else set(0);
  }, [enabled]);

  return enabled ? value : 0;
}
