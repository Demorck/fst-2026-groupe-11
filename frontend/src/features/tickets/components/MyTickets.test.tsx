import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DialogHost from '../../../components/DialogHost.tsx';
import MyTickets from './MyTickets.tsx';

const ticket = {
  id: 't1',
  code: 'B2H9M3V3',
  status: 'RESERVED',
  checkedInAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  event: {
    id: 'e1',
    title: 'Gala',
    // Relative: the page splits upcoming tickets from past ones
    startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    endsAt: new Date(
      Date.now() + 30 * 86_400_000 + 4 * 3_600_000,
    ).toISOString(),
    location: 'Nancy',
  },
};

const stubFetch = (response: Response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const renderTickets = () =>
  render(
    <MemoryRouter>
      <MyTickets />
      <DialogHost />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.setItem(
    'session',
    JSON.stringify({
      accessToken: 't',
      user: { id: 'u1', email: 'a@b.fr', name: 'Alice', role: 'PARTICIPANT' },
    }),
  );
});

describe('MyTickets', () => {
  it('says how far away an event is, beyond two weeks too', async () => {
    const startsAt = new Date(Date.now() + 20 * 86_400_000).toISOString();
    stubFetch(
      new Response(
        JSON.stringify([
          { ...ticket, event: { ...ticket.event, startsAt, endsAt: startsAt } },
        ]),
      ),
    );
    renderTickets();

    expect(await screen.findByText('Dans 20 jours')).toBeVisible();
  });

  it('lists each ticket with its event, date, code and a link to the event', async () => {
    const fetch = stubFetch(new Response(JSON.stringify([ticket])));
    renderTickets();

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Gala' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    expect(screen.getByText('B2H9M3V3')).toBeInTheDocument();
    expect(screen.getByText('Nancy')).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(String(new Date(ticket.event.startsAt).getFullYear())),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code du billet B2H9M3V3' }),
    ).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/me/tickets');
  });

  it('separates upcoming tickets from past ones, most recent past first', async () => {
    const at = (days: number) =>
      new Date(Date.now() + days * 864e5).toISOString();
    const make = (id: string, title: string, days: number) => ({
      ...ticket,
      id,
      code: id,
      event: {
        ...ticket.event,
        id,
        title,
        startsAt: at(days),
        endsAt: at(days),
      },
    });
    stubFetch(
      new Response(
        JSON.stringify([
          make('old', 'Vieux', -20),
          make('recent', 'Récent', -2),
          make('next', 'Prochain', 3),
        ]),
      ),
    );
    renderTickets();

    await screen.findByRole('link', { name: 'Prochain' });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Prochain billet', 'Passés']);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['Prochain', 'Récent', 'Vieux'],
    );
  });

  it('gives the next ticket its own section, then the others as upcoming', async () => {
    const at = (days: number) =>
      new Date(Date.now() + days * 864e5).toISOString();
    const make = (id: string, days: number) => ({
      ...ticket,
      id,
      code: id,
      event: {
        ...ticket.event,
        id,
        title: id,
        startsAt: at(days),
        endsAt: at(days),
      },
    });
    stubFetch(
      new Response(
        JSON.stringify([make('past', -3), make('first', 2), make('second', 9)]),
      ),
    );
    renderTickets();

    await screen.findByRole('link', { name: 'first' });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Prochain billet', 'À venir', 'Passés']);
    // a past ticket keeps its code but no QR code
    expect(screen.getAllByText('past')).toHaveLength(2); // title and code
    expect(
      screen.queryByRole('img', { name: 'QR code du billet past' }),
    ).toBeNull();
    expect(
      screen.getByRole('img', { name: 'QR code du billet second' }),
    ).toBeInTheDocument();
  });

  it('shows when the attendance is already validated', async () => {
    stubFetch(
      new Response(
        JSON.stringify([
          { ...ticket, checkedInAt: '2026-12-01T19:05:00.000Z' },
        ]),
      ),
    );
    renderTickets();

    expect(await screen.findByText('Présence validée')).toBeInTheDocument();
  });

  it('invites to browse the events when there is no ticket', async () => {
    stubFetch(new Response('[]'));
    renderTickets();

    expect(
      await screen.findByRole('link', { name: 'Voir les événements' }),
    ).toHaveAttribute('href', '/');
  });

  it('shows the API error', async () => {
    stubFetch(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    renderTickets();

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('cancels an upcoming ticket, which then leaves the page', async () => {
    let held = [ticket];
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') held = [];
      return Promise.resolve(new Response(JSON.stringify(held)));
    });
    vi.stubGlobal('fetch', fetch);
    renderTickets();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Annuler la réservation de Gala',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Confirmer',
      }),
    );

    expect(
      await screen.findByText("Vous n'avez pas encore de billet."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/e1/tickets',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('offers no cancellation once attendance is validated or the event is over', async () => {
    const past = {
      ...ticket,
      id: 'p',
      code: 'PAST',
      event: {
        ...ticket.event,
        id: 'p',
        title: 'Hier',
        startsAt: '2020-01-01T10:00:00.000Z',
        endsAt: '2020-01-01T12:00:00.000Z',
      },
    };
    stubFetch(
      new Response(
        JSON.stringify([
          { ...ticket, checkedInAt: '2026-12-01T19:05:00.000Z' },
          past,
        ]),
      ),
    );
    renderTickets();

    await screen.findByText('Présence validée');
    expect(screen.queryByRole('button', { name: /Annuler/ })).toBeNull();
  });

  it('offers no cancellation while the event is running', async () => {
    stubFetch(
      new Response(
        JSON.stringify([
          {
            ...ticket,
            event: {
              ...ticket.event,
              startsAt: new Date(Date.now() - 3_600_000).toISOString(),
              endsAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
          },
        ]),
      ),
    );
    renderTickets();

    await screen.findByText('B2H9M3V3');
    expect(screen.queryByRole('button', { name: /Annuler/ })).toBeNull();
  });
});
