import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import EventDetailPage from './EventDetailPage.tsx';
import EventsPage from './EventsPage.tsx';

const event = {
  id: 'e1',
  title: 'Gala',
  description: 'Soirée',
  startsAt: '2026-12-01T19:00:00.000Z',
  endsAt: '2026-12-01T23:00:00.000Z',
  location: 'Nancy',
  capacity: 50,
  category: 'PARTY',
  imageUrl: null,
  organizer: { id: 'org-1', name: 'BDE' },
  remainingSeats: 12,
};

function renderAt(path: string, response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  const router = createMemoryRouter(
    [
      { path: '/', element: <EventsPage /> },
      { path: '/events/:eventId', element: <EventDetailPage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('EventsPage', () => {
  it('lists upcoming events with a link to their detail', async () => {
    const fetch = renderAt('/', json([event]));

    expect(await screen.findByRole('link', { name: 'Gala' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    expect(screen.getByText('12 place(s) restante(s)')).toBeInTheDocument();
    expect(screen.getByText('Soirée')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toMatch(/^\/api\/events\?from=/);
  });

  it('shows an empty state', async () => {
    renderAt('/', json([]));

    expect(
      await screen.findByText('Aucun événement à venir pour le moment.'),
    ).toBeInTheDocument();
  });

  it('shows the API error', async () => {
    renderAt('/', json({ message: 'boom' }, 500));

    expect(await screen.findByText('Erreur : boom')).toBeInTheDocument();
  });
});

describe('EventDetailPage', () => {
  it('shows the event and its remaining seats', async () => {
    const fetch = renderAt('/events/e1', json(event));

    expect(
      await screen.findByRole('heading', { name: 'Gala' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 restante(s) sur 50')).toBeInTheDocument();
    expect(screen.getByText('BDE')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/events/e1');
  });

  it('shows the not found page on 404', async () => {
    renderAt('/events/nope', json({ message: 'Event not found' }, 404));

    expect(
      await screen.findByRole('heading', { name: 'Page introuvable' }),
    ).toBeInTheDocument();
  });
});
