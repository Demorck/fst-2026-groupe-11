import { render, screen } from '@testing-library/react';
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

const stubFetch = (response: Response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const clickReserve = () =>
  userEvent.click(screen.getByRole('button', { name: 'Réserver' }));
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
    expect(fetch).not.toHaveBeenCalled();
  });

  it('goes back to the button when the confirmation is cancelled', async () => {
    logInAs('PARTICIPANT');
    const fetch = stubFetch(new Response('{}'));
    renderButton();

    await clickReserve();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Réserver' })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
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
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/events/e1/tickets');
    expect(init.method).toBe('POST');
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
});
