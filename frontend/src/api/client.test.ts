import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client.ts';

const session = {
  accessToken: 'token',
  user: { id: 'u1', email: 'a@b.fr', name: 'Alice', role: 'ORGANIZER' },
};

describe('apiFetch', () => {
  it('sends the session token as a bearer header', async () => {
    localStorage.setItem('session', JSON.stringify(session));
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);

    await apiFetch('/events');

    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer token',
    });
  });

  it('logs out on a 401', async () => {
    localStorage.setItem('session', JSON.stringify(session));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );

    await expect(apiFetch('/events')).rejects.toThrow();
    expect(localStorage.getItem('session')).toBeNull();
  });

  it('returns nothing on a 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      apiFetch('/shifts/s1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });
});
