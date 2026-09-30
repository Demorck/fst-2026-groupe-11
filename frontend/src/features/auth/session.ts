import { useMemo, useSyncExternalStore } from 'react';
import type { LoginResponse } from './types.ts';

const KEY = 'session';
const listeners = new Set<() => void>();

export function saveSession(session: LoginResponse) {
  localStorage.setItem(KEY, JSON.stringify(session));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // also follow logins and logouts made in another tab
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', notify);
  };
}

/** Current session, or null when logged out. Re-renders on change. */
export function useSession(): LoginResponse | null {
  // the raw string is the snapshot: it stays stable between renders, unlike a parsed object
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY));
  return useMemo(
    () => (raw ? (JSON.parse(raw) as LoginResponse) : null),
    [raw],
  );
}
