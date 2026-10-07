import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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
    startsAt: '2026-12-01T19:00:00.000Z',
    endsAt: '2026-12-01T23:00:00.000Z',
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
    </MemoryRouter>,
  );

describe('MyTickets', () => {
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
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code du billet B2H9M3V3' }),
    ).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/me/tickets');
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
});
