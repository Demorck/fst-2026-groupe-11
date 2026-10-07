import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '../../auth/types.ts';
import ReserveButton from './ReserveButton.tsx';

function logInAs(role: Role) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

const renderButton = () =>
  render(
    <MemoryRouter>
      <ReserveButton eventId="e1" />
    </MemoryRouter>,
  );

/** `reserve` answers the booking (POST), `mine` the tickets already held (GET /me/tickets). */
const stubFetch = (reserve: Response, mine: unknown[] = []) => {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'POST' ? reserve : new Response(JSON.stringify(mine)),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const posts = (fetch: ReturnType<typeof stubFetch>) =>
  fetch.mock.calls.filter(([, init]) => init?.method === 'POST');

// The button waits for the lookup of an already held ticket
const clickReserve = async () => {
  const button = screen.getByRole('button', { name: 'Réserver' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
};
const clickConfirm = () =>
  userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

describe('ReserveButton', () => {
  it('offers a login link when logged out', () => {
    renderButton();

    expect(
      screen.getByRole('link', { name: 'Connectez-vous pour réserver' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['ORGANIZER', 'VOLUNTEER'] as const)(
    'renders nothing for a %s',
    (role) => {
      logInAs(role);

      const { container } = renderButton();

      expect(container).toBeEmptyDOMElement();
    },
  );

  it('asks for a confirmation before calling the API', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'));
    renderButton();

    await clickReserve();

    expect(screen.getByText(/Confirmer la réservation/)).toBeInTheDocument();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('goes back to the button when the confirmation is cancelled', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'));
    renderButton();

    await clickReserve();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Réserver' })).toBeVisible();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('books the place and shows the ticket code', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response(JSON.stringify({ code: 'B2H9M3V3' })));
    renderButton();

    await clickReserve();
    await clickConfirm();

    expect(await screen.findByRole('status')).toHaveTextContent('B2H9M3V3');
    expect(
      screen.getByRole('img', { name: 'QR code du billet B2H9M3V3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir mes billets' }),
    ).toHaveAttribute('href', '/me/tickets');
    const [url] = posts(fetch)[0];
    expect(url).toBe('/api/events/e1/tickets');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['Event is full', 'Cet événement est complet.'],
    [
      'Ticket already booked',
      'Vous avez déjà réservé une place pour cet événement.',
    ],
  ])('translates the "%s" refusal', async (message, text) => {
    logInAs('PARTICIPANT');
    stubFetch(new Response(JSON.stringify({ message }), { status: 409 }));
    renderButton();

    await clickReserve();
    await clickConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeVisible();
  });

  it('shows the code and QR code of a ticket already held, without booking button', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'), [
      { code: 'HELD1234', event: { id: 'e1' } },
      { code: 'OTHER000', event: { id: 'e2' } },
    ]);
    renderButton();

    expect(await screen.findByRole('status')).toHaveTextContent('HELD1234');
    expect(
      screen.getByRole('img', { name: 'QR code du billet HELD1234' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('keeps the booking button when the lookup of held tickets fails', async () => {
    logInAs('PARTICIPANT');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderButton();

    const button = screen.getByRole('button', { name: 'Réserver' });
    await waitFor(() => expect(button).toBeEnabled());
  });
});
