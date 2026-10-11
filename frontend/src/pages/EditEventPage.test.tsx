import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import EditEventPage from './EditEventPage.tsx';

const event = {
  id: 'e1',
  title: 'Gala',
  description: 'Soirée',
  startsAt: new Date(2026, 11, 1, 19, 0).toISOString(),
  endsAt: new Date(2026, 11, 1, 23, 0).toISOString(),
  location: 'Nancy',
  capacity: 50,
  category: 'PARTY',
  imageUrl: null,
  organizer: { id: 'u1', name: 'Alice' },
  remainingSeats: 40,
  // o2 is run by someone else: it must stay on the event
  organizations: [
    { id: 'o1', name: 'BDE', description: null, hasLogo: false },
    { id: 'o2', name: 'Club Sport', description: null, hasLogo: false },
  ],
  volunteers: { required: 0, registered: 0, missing: 0 },
  volunteerStatus: null,
  canManage: true,
  canVolunteer: true,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** GET answers with the event (or `found`) and the managed organizations, PATCH with `patch`. */
function renderPage(found: object = event, patch = () => json(event)) {
  const fetch = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'PATCH'
        ? patch()
        : url === '/api/organizations/mine'
          ? json([{ id: 'o1', name: 'BDE', role: 'MANAGER' }])
          : json(found),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const router = createMemoryRouter(
    [
      { path: '/events/:eventId/edit', element: <EditEventPage /> },
      { path: '/events/:eventId', element: <p>Détail</p> },
    ],
    { initialEntries: ['/events/e1/edit'] },
  );
  render(<RouterProvider router={router} />);
  return { fetch, router };
}

const save = () =>
  userEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  );

describe('EditEventPage', () => {
  it('fills the form with the event and saves the changes', async () => {
    const { fetch, router } = renderPage();

    const title = await screen.findByLabelText('Titre');
    expect(title).toHaveValue('Gala');
    expect(screen.getByLabelText('Capacité')).toHaveValue(50);
    await userEvent.clear(title);
    await userEvent.type(title, 'Grand gala');
    await save();

    const [url, init] = fetch.mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    )!;
    expect(url).toBe('/api/events/e1');
    const body = JSON.parse(init!.body as string);
    expect(body.title).toBe('Grand gala');
    expect(body.startsAt).toBe(event.startsAt);
    // the co-organizer the user does not manage is kept
    expect(body.organizationIds).toEqual(['o1', 'o2']);
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/events/e1'),
    );
  });

  it('shows the co-organizer the user does not manage as locked', async () => {
    renderPage();

    expect(
      await screen.findByRole('checkbox', { name: 'Club Sport' }),
    ).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'BDE' })).toBeEnabled();
  });

  it('explains in French a capacity below the reserved tickets', async () => {
    renderPage(event, () =>
      json(
        { message: 'Capacity is below the number of reserved tickets' },
        409,
      ),
    );

    await screen.findByLabelText('Titre');
    await save();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La capacité ne peut pas descendre sous le nombre de billets déjà réservés.',
    );
  });

  it('refuses an organizer who does not manage the event', async () => {
    renderPage({ ...event, canManage: false });

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
    expect(screen.queryByLabelText('Titre')).toBeNull();
  });
});
