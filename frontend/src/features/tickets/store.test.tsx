import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '../auth/session.ts';
import { bookTicket, resetTicketsStore, useMyTickets } from './store.ts';

const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role: 'PARTICIPANT' };
const held = {
  id: 't1',
  code: 'B2H9M3V3',
  status: 'RESERVED',
  checkedInAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  event: {
    id: 'e1',
    title: 'Gala',
    startsAt: '2026-12-01T19:00:00.000Z',
    endsAt: '2026-12-01T23:00:00.000Z',
    location: 'Nancy',
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** Answers the calls in order, whatever their URL. */
const stubFetch = (...responses: Response[]) => {
  const fetch = vi.fn();
  responses.forEach((response) => fetch.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

beforeEach(() => {
  resetTicketsStore();
  saveSession({ accessToken: 't', user } as Parameters<typeof saveSession>[0]);
});

describe('tickets store', () => {
  it('tries again when a page opens after a failed load', async () => {
    stubFetch(json({ message: 'Boom' }, 500), json([held]));

    const first = renderHook(() => useMyTickets());
    await waitFor(() => expect(first.result.current.error).toBe('Boom'));
    first.unmount();

    const second = renderHook(() => useMyTickets());
    await waitFor(() => expect(second.result.current.tickets).toEqual([held]));
    expect(second.result.current.error).toBeNull();
  });

  it('reloads the list when it cannot be read after a booking', async () => {
    const fetch = stubFetch(
      json([]), // first load
      json(held), // POST: booked
      json({ message: 'Boom' }, 500), // refresh fails
      json([held]), // the hook loads again
    );
    const { result } = renderHook(() => useMyTickets());
    await waitFor(() => expect(result.current.tickets).toEqual([]));

    await act(() => bookTicket('e1'));

    await waitFor(() => expect(result.current.tickets).toEqual([held]));
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('drops a slow older read that would overwrite a newer one', async () => {
    let release: (response: Response) => void = () => {};
    const slow = new Promise<Response>((resolve) => (release = resolve));
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return json(held);
        reads += 1;
        if (reads === 1) return json([]); // first load
        if (reads === 2) return slow; // refresh of the first booking, answered last
        return json([held]); // refresh of the second booking
      }),
    );
    const { result } = renderHook(() => useMyTickets());
    await waitFor(() => expect(result.current.tickets).toEqual([]));

    const first = bookTicket('e1');
    const second = bookTicket('e1');
    await act(() => second);
    expect(result.current.tickets).toEqual([held]);

    release(json([]));
    await act(() => first);
    expect(result.current.tickets).toEqual([held]);
  });

  it('forgets the tickets at logout', async () => {
    const fetch = stubFetch(json([held]), json([]));
    const { result } = renderHook(() => useMyTickets());
    await waitFor(() => expect(result.current.tickets).toEqual([held]));

    act(() => clearSession());
    expect(result.current.tickets).toBeNull();

    act(() => saveSession({ accessToken: 't', user } as never));
    await waitFor(() => expect(result.current.tickets).toEqual([]));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
