import { render, screen, within } from '@testing-library/react';
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
  organizations: [
    {
      id: 'o1',
      name: 'BDE Nancy',
      description: null,
      hasLogo: false,
      updatedAt: '2026-10-07T10:00:00.000Z',
    },
    {
      id: 'o2',
      name: 'Club Sport',
      description: null,
      hasLogo: true,
      updatedAt: '2026-10-07T10:00:00.000Z',
    },
  ],
  volunteerStatus: null,
  volunteers: { required: 5, registered: 3, missing: 2 },
};

function logInAs(role: string) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

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

  it('shows a bubble per organization under each event', async () => {
    renderAt('/', json([event]));

    const bubbles = await screen.findByRole('list', { name: 'Organisations' });

    expect(within(bubbles).getAllByRole('listitem')).toHaveLength(2);
    expect(within(bubbles).getByText('BDE Nancy')).toBeInTheDocument();
    expect(within(bubbles).getByText('Club Sport')).toBeInTheDocument();
  });

  it.each([
    ['ASSIGNED', 'Vous êtes bénévole sur cet événement', 'bg-green-100'],
    ['AVAILABLE', 'Vous pouvez bénévoler à cet événement', 'bg-gray-100'],
  ])('shows the %s badge of a volunteer', async (status, text, color) => {
    renderAt('/', json([{ ...event, volunteerStatus: status }]));

    expect(await screen.findByText(text)).toHaveClass(color);
  });

  it('shows no badge without volunteer status', async () => {
    renderAt('/', json([event]));

    await screen.findByRole('link', { name: 'Gala' });

    expect(screen.queryByText(/bénévol/)).toBeNull();
  });

  it.each([
    ['VOLUNTEER', true],
    ['ORGANIZER', true],
    ['PARTICIPANT', false],
  ])('shows the shortage of volunteers to a %s: %s', async (role, shown) => {
    logInAs(role);
    renderAt('/', json([event]));

    await screen.findByRole('link', { name: 'Gala' });

    expect(screen.queryByText('Il manque 2 bénévole(s)') !== null).toBe(shown);
  });

  it('shows no shortage to a visitor, nor when the shifts are covered', async () => {
    renderAt('/', json([event]));
    await screen.findByRole('link', { name: 'Gala' });
    expect(screen.queryByText(/Il manque/)).toBeNull();
  });

  it('shows no shortage on a covered event', async () => {
    logInAs('VOLUNTEER');
    renderAt(
      '/',
      json([
        { ...event, volunteers: { required: 5, registered: 5, missing: 0 } },
      ]),
    );

    await screen.findByRole('link', { name: 'Gala' });

    expect(screen.queryByText(/Il manque/)).toBeNull();
  });

  it('links each organization bubble to its public page', async () => {
    renderAt('/', json([event]));

    const bubbles = await screen.findByRole('list', { name: 'Organisations' });

    expect(
      within(bubbles).getByRole('link', { name: 'BDE Nancy' }),
    ).toHaveAttribute('href', '/organizations/o1');
  });

  it('filters on one organization from the query string, with a way back', async () => {
    const fetch = renderAt('/?organization=o2', json([event]));

    expect(
      await screen.findByText('Organisation : Club Sport'),
    ).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toContain('&organizationId=o2');
    expect(
      screen.getByRole('link', { name: 'Retirer le filtre par organisation' }),
    ).toHaveAttribute('href', '/');
  });

  it('does not filter by default', async () => {
    const fetch = renderAt('/', json([event]));

    await screen.findByRole('link', { name: 'Gala' });

    expect(fetch.mock.calls[0][0]).not.toContain('organizationId');
    expect(screen.queryByText(/Organisation :/)).toBeNull();
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

  it('lists the organizations of the event', async () => {
    renderAt('/events/e1', json(event));

    await screen.findByRole('heading', { name: 'Gala' });

    expect(screen.getByText('BDE Nancy')).toBeInTheDocument();
    expect(screen.getByText('Club Sport')).toBeInTheDocument();
  });

  it('links each organization to its public page', async () => {
    renderAt('/events/e1', json(event));

    expect(
      await screen.findByRole('link', { name: 'Club Sport' }),
    ).toHaveAttribute('href', '/organizations/o2');
  });

  it('shows volunteers and organizers how many volunteers the shifts have and miss', async () => {
    logInAs('VOLUNTEER');
    renderAt('/events/e1', json(event));

    expect(await screen.findByText(/3 sur 5/)).toBeInTheDocument();
    expect(screen.getByText('Il manque 2 bénévole(s)')).toBeInTheDocument();
  });

  it('hides the volunteers line from a participant and when there is no shift', async () => {
    logInAs('PARTICIPANT');
    renderAt('/events/e1', json(event));
    await screen.findByRole('heading', { name: 'Gala' });
    expect(screen.queryByText('Bénévoles')).toBeNull();
  });

  it('hides the volunteers line when the event has no shift', async () => {
    logInAs('ORGANIZER');
    renderAt(
      '/events/e1',
      json({
        ...event,
        volunteers: { required: 0, registered: 0, missing: 0 },
      }),
    );
    await screen.findByRole('heading', { name: 'Gala' });
    expect(screen.queryByText('Bénévoles')).toBeNull();
  });

  it('shows the volunteer badge', async () => {
    renderAt('/events/e1', json({ ...event, volunteerStatus: 'ASSIGNED' }));

    expect(
      await screen.findByText('Vous êtes bénévole sur cet événement'),
    ).toBeInTheDocument();
  });

  it('lets a participant book a place', async () => {
    logInAs('PARTICIPANT');
    renderAt('/events/e1', json(event));

    expect(
      await screen.findByRole('button', { name: 'Réserver' }),
    ).toBeEnabled();
  });

  it('offers a login link to a visitor instead of booking', async () => {
    renderAt('/events/e1', json(event));

    expect(
      await screen.findByRole('link', { name: 'Connectez-vous pour réserver' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réserver' })).toBeNull();
  });

  it('shows the not found page on 404', async () => {
    renderAt('/events/nope', json({ message: 'Event not found' }, 404));

    expect(
      await screen.findByRole('heading', { name: 'Page introuvable' }),
    ).toBeInTheDocument();
  });
});
