import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '../../auth/types.ts';
import DialogHost from '../../../components/DialogHost.tsx';
import ReserveButton from './ReserveButton.tsx';

function logInAs(role: Role) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

const inOneDay = new Date(Date.now() + 86_400_000).toISOString();
const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();

const renderButton = (startsAt = inOneDay) =>
  render(
    <MemoryRouter>
      <ReserveButton eventId="e1" startsAt={startsAt} />
      <DialogHost />
    </MemoryRouter>,
  );

type Held = { code: string; event: { id: string; startsAt: string } };

/**
 * A small server: `reserve` answers the booking (POST), `cancel` the cancellation (DELETE), and
 * GET /me/tickets lists what the user holds, which follows the accepted bookings and cancellations.
 */
const stubFetch = (
  reserve: Response,
  mine: Held[] = [],
  cancel = new Response('{}'),
) => {
  const held = [...mine];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (reserve.ok) {
        const { code } = (await reserve.clone().json()) as { code: string };
        held.push({ code, event: { id: 'e1', startsAt: inOneDay } });
      }
      return reserve;
    }
    if (init?.method === 'DELETE') {
      if (cancel.ok) held.length = 0;
      return cancel;
    }
    return new Response(JSON.stringify(held));
  });
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
  userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Confirmer',
    }),
  );

describe('ReserveButton', () => {
  it('offers a login link when logged out', () => {
    renderButton();

    expect(
      screen.getByRole('link', { name: 'Connectez-vous pour réserver' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['ORGANIZER', 'VOLUNTEER'] as const)(
    'lets a %s book a ticket like a participant',
    async (role) => {
      logInAs(role);
      stubFetch(new Response('{}'));

      renderButton();

      expect(
        await screen.findByRole('button', { name: 'Réserver' }),
      ).toBeVisible();
    },
  );

  it('asks for a confirmation before calling the API', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'));
    renderButton();

    await clickReserve();

    expect(
      screen.getByRole('alertdialog', { name: /Réserver une place/ }),
    ).toBeInTheDocument();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('goes back to the button when the confirmation is cancelled', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'));
    renderButton();

    await clickReserve();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeVisible();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('books the place and shows the ticket code', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response(JSON.stringify({ code: 'B2H9M3V3' })));
    renderButton();

    await clickReserve();
    await clickConfirm();

    // the new ticket is shown in a modal first
    const modal = await screen.findByRole('dialog', {
      name: 'Place réservée !',
    });
    expect(modal).toHaveTextContent('B2H9M3V3');
    expect(
      within(modal).getByRole('img', { name: 'QR code du billet B2H9M3V3' }),
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole('link', { name: 'Voir mes billets' }),
    ).toHaveAttribute('href', '/me/tickets');
    const [url] = posts(fetch)[0];
    expect(url).toBe('/api/events/e1/tickets');

    // then stays on the page once closed
    await userEvent.click(
      within(modal).getByRole('button', { name: 'Fermer' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('B2H9M3V3');
    expect(screen.queryByRole('button', { name: 'Réserver' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Annuler ma réservation' }),
    ).toBeInTheDocument();
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

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(text);
    await userEvent.click(screen.getByRole('button', { name: 'Compris' }));
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeVisible();
  });

  it('shows the code and QR code of a ticket already held, without booking button', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'), [
      { code: 'HELD1234', event: { id: 'e1', startsAt: inOneDay } },
      { code: 'OTHER000', event: { id: 'e2', startsAt: inOneDay } },
    ]);
    renderButton();

    expect(await screen.findByRole('status')).toHaveTextContent('HELD1234');
    expect(
      screen.getByRole('img', { name: 'QR code du billet HELD1234' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réserver' })).toBeNull();
    expect(posts(fetch)).toHaveLength(0);
  });

  it('keeps the booking button when the lookup of held tickets fails', async () => {
    logInAs('PARTICIPANT');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderButton();

    const button = screen.getByRole('button', { name: 'Réserver' });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('cancels the reservation, then offers to book again', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'), [
      { code: 'HELD1234', event: { id: 'e1', startsAt: inOneDay } },
    ]);
    renderButton();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Annuler ma réservation' }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Annuler la réservation',
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'Réserver' }),
    ).toBeVisible();
    expect(screen.queryByText('HELD1234')).toBeNull();
    const [url, init] = fetch.mock.calls.find(
      ([, init]) => init?.method === 'DELETE',
    ) as [string, RequestInit];
    expect(url).toBe('/api/events/e1/tickets');
    expect(init.method).toBe('DELETE');
    expect(screen.getByText('Réservation annulée.')).toBeInTheDocument();
  });

  it('keeps the reservation when the cancellation is dismissed', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'), [
      { code: 'HELD1234', event: { id: 'e1', startsAt: inOneDay } },
    ]);
    renderButton();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Annuler ma réservation' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('status')).toHaveTextContent('HELD1234');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false,
    );
  });

  it('explains why a cancellation is refused', async () => {
    logInAs('PARTICIPANT');
    stubFetch(
      new Response('{}'),
      [{ code: 'HELD1234', event: { id: 'e1', startsAt: inOneDay } }],
      new Response(JSON.stringify({ message: 'Ticket already used' }), {
        status: 409,
      }),
    );
    renderButton();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Annuler ma réservation' }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Annuler la réservation',
      }),
    );

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Votre présence est déjà validée',
    );
    expect(screen.getByRole('status')).toHaveTextContent('HELD1234');
  });

  it('offers no cancellation once the event has started', async () => {
    logInAs('PARTICIPANT');
    stubFetch(new Response('{}'), [
      { code: 'HELD1234', event: { id: 'e1', startsAt: anHourAgo } },
    ]);
    renderButton(anHourAgo);

    expect(await screen.findByRole('status')).toHaveTextContent('HELD1234');
    expect(
      screen.queryByRole('button', { name: 'Annuler ma réservation' }),
    ).not.toBeInTheDocument();
  });

  it('closes the reservations once the event has started, without opening the dialog', async () => {
    logInAs('PARTICIPANT');
    stubFetch(new Response('{}'));
    renderButton(anHourAgo);

    expect(await screen.findByText(/réservations sont fermées/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Réserver' })).toBeNull();
  });
});
