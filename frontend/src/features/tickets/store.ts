import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from '../auth/session.ts';
import {
  cancelTicket as cancelApi,
  getMyTickets,
  reserveTicket,
} from './api.ts';
import type { MyTicket } from './types.ts';

/**
 * The tickets of the logged in user, shared by every page: booking or cancelling here updates the
 * detail page, the cards and "Mes billets" at once. `version` goes up after each change so that
 * pages showing seats (event list and detail, public page of an organization) load their data again.
 */
interface State {
  /** Who the tickets belong to: another user never sees them. */
  owner: string | null;
  tickets: MyTicket[] | null;
  error: string | null;
  loading: boolean;
  version: number;
}

const INITIAL: State = {
  owner: null,
  tickets: null,
  error: null,
  loading: false,
  version: 0,
};
let state = INITIAL;
// Each read of the tickets gets a number: only the latest one may write, so a slow older answer is dropped
let latestRead = 0;
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

async function load(owner: string) {
  const read = ++latestRead;
  update({ owner, tickets: null, error: null, loading: true });
  try {
    const tickets = await getMyTickets();
    if (state.owner === owner && read === latestRead) {
      update({ tickets, loading: false });
    }
  } catch (err) {
    if (state.owner === owner && read === latestRead) {
      update({ error: (err as Error).message, loading: false });
    }
  }
}

/** Reads the tickets again without blanking what is shown. */
async function refresh() {
  if (!state.owner) return;
  const owner = state.owner;
  const read = ++latestRead;
  try {
    const tickets = await getMyTickets();
    if (state.owner === owner && read === latestRead) {
      update({ tickets, error: null });
    }
  } catch {
    // The change itself succeeded: do not keep a list that is now wrong, let the hooks load it again
    if (state.owner === owner && read === latestRead) {
      update({ owner: null, tickets: null });
    }
  }
}

export async function bookTicket(eventId: string) {
  const ticket = await reserveTicket(eventId);
  await refresh();
  update({ version: state.version + 1 });
  return ticket;
}

export async function cancelTicket(eventId: string) {
  await cancelApi(eventId);
  await refresh();
  update({ version: state.version + 1 });
}

/** For tests: nothing left from the previous one. */
export function resetTicketsStore() {
  state = INITIAL;
  latestRead = 0;
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** `tickets` is null until loaded; `error` is set when they could not be read. */
export function useMyTickets(enabled = true) {
  const userId = useSession()?.user.id;
  const current = useSyncExternalStore(subscribe, () => state);
  const owner = enabled ? (userId ?? null) : null;

  useEffect(() => {
    if (owner && state.owner !== owner) void load(owner);
  }, [owner, current.owner]);

  // A page that opens tries again after a failed load
  useEffect(() => {
    if (owner && state.error && !state.loading) void load(owner);
  }, [owner]);

  // Logged out: the next account must not see these tickets
  useEffect(() => {
    if (!userId && state.owner) resetTicketsStore();
  }, [userId]);

  const mine = owner !== null && current.owner === owner;
  return {
    tickets: mine ? current.tickets : null,
    error: mine ? current.error : null,
  };
}

/**
 * The active ticket of the logged in user for an event, if any (cards, detail page).
 * `loading` is true while the answer is unknown, so that nothing claims "no ticket" too early.
 */
export function useHeldTicket(eventId: string) {
  const loggedIn = !!useSession();
  const { tickets, error } = useMyTickets(loggedIn);
  return {
    held: tickets?.find(({ event }) => event.id === eventId) ?? null,
    loading: loggedIn && tickets === null && error === null,
  };
}

/** Goes up when a ticket is booked or cancelled: add it to the dependencies of a data load. */
export function useDataVersion() {
  return useSyncExternalStore(subscribe, () => state.version);
}
