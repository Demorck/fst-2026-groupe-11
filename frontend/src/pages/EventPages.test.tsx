import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import DialogHost from '../components/DialogHost.tsx';
import { bookTicket, cancelTicket } from '../features/tickets/store.ts';
import EventDetailPage from './EventDetailPage.tsx';
import EventsPage from './EventsPage.tsx';

// Relative dates: the detail page closes the reservations of an event that has started
const inThirtyDays = Date.now() + 30 * 86_400_000;

const event = {
  id: 'e1',
  title: 'Gala',
  description: 'Soirée',
  startsAt: new Date(inThirtyDays).toISOString(),
  endsAt: new Date(inThirtyDays + 4 * 3_600_000).toISOString(),
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
  // a participant's detail page also looks for the tickets already held
  const fetch = vi.fn((url: string) =>
    Promise.resolve(url === '/api/me/tickets' ? new Response('[]') : response),
  );
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
    // the pill of the filter shares this label: look inside the card
    const card = screen.getByRole('link', { name: 'Gala' }).closest('li');
    expect(within(card as HTMLElement).getByText('Soirée')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toMatch(/^\/api\/events\?from=/);
  });

  it('shows a bubble per organization under each event', async () => {
    renderAt('/', json([event]));

    const bubbles = await screen.findByRole('list', { name: 'Organisations' });

    expect(within(bubbles).getAllByRole('listitem')).toHaveLength(2);
    expect(within(bubbles).getByText('BDE Nancy')).toBeInTheDocument();
    expect(within(bubbles).getByText('Club Sport')).toBeInTheDocument();
  });

  it('filters the list by category and by search', async () => {
    const other = { ...event, id: 'e2', title: 'Tournoi', category: 'SPORT' };
    renderAt('/', json([event, other]));
    await screen.findByRole('link', { name: 'Gala' });

    await userEvent.click(screen.getByRole('radio', { name: 'Sport' }));

    expect(screen.queryByRole('link', { name: 'Gala' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tournoi' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Toutes' }));
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Rechercher un événement' }),
      'gal',
    );

    expect(screen.getByRole('link', { name: 'Gala' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tournoi' })).toBeNull();

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Rechercher un événement' }),
      'xyz',
    );

    expect(
      screen.getByText('Aucun événement ne correspond à votre recherche.'),
    ).toBeInTheDocument();
  });

  it('shows three organizations at most on a card, then how many more', async () => {
    const organizations = ['A', 'B', 'C', 'D', 'E'].map((name) => ({
      ...event.organizations[0],
      id: `o${name}`,
      name,
    }));
    renderAt('/', json([{ ...event, organizations }]));

    const bubbles = await screen.findByRole('list', { name: 'Organisations' });

    expect(within(bubbles).getAllByRole('link')).toHaveLength(3);
    expect(within(bubbles).getByText('+2 organisations')).toBeInTheDocument();
  });

  it.each([
    ['ASSIGNED', 'Vous êtes bénévole sur cet événement', true],
    ['AVAILABLE', 'Vous pouvez vous inscrire comme bénévole', false],
  ])('shows the %s badge of a volunteer', async (status, text, assigned) => {
    renderAt('/', json([{ ...event, volunteerStatus: status }]));

    expect((await screen.findByText(text)).classList.contains('badge-ok')).toBe(
      assigned,
    );
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

    const button = await screen.findByRole('button', { name: 'Réserver' });
    await waitFor(() => expect(button).toBeEnabled());
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

describe('a full event', () => {
  const full = { ...event, remainingSeats: 0 };
  const heldTicket = {
    id: 't1',
    code: 'ABCD2345',
    status: 'RESERVED',
    checkedInAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    event: { ...event, id: 'e1' },
  };

  function renderWithTickets(path: string, body: unknown, tickets: unknown[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(url === '/api/me/tickets' ? json(tickets) : json(body)),
      ),
    );
    const router = createMemoryRouter(
      [
        { path: '/', element: <EventsPage /> },
        { path: '/events/:eventId', element: <EventDetailPage /> },
      ],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
  }

  it('keeps the color of its category, and tells a visitor that no ticket is left', async () => {
    renderAt('/', json([full]));

    const card = (await screen.findByRole('link', { name: 'Gala' })).closest(
      'li',
    ) as HTMLElement;
    expect(within(card).getByText("Aucun billet n'est disponible")).toHaveClass(
      'badge-danger',
    );
    // PARTY tint, not the grey of "OTHER"
    expect(card.firstElementChild).not.toHaveStyle({
      backgroundColor: '#ECEDF1',
    });
  });

  it('shows the ticket held instead of the red bubble', async () => {
    logInAs('PARTICIPANT');
    renderWithTickets('/', [full], [heldTicket]);

    const card = (await screen.findByRole('link', { name: 'Gala' })).closest(
      'li',
    ) as HTMLElement;
    expect(await within(card).findByText('Vous avez un billet')).toBeVisible();
    expect(
      within(card).queryByText("Aucun billet n'est disponible"),
    ).toBeNull();
  });

  it.each(['VOLUNTEER', 'ORGANIZER'])(
    'shows the red bubble to a %s, who books like a participant',
    async (role) => {
      logInAs(role);
      renderWithTickets('/', [full], []);

      await screen.findByRole('link', { name: 'Gala' });
      expect(
        await screen.findByText("Aucun billet n'est disponible"),
      ).toBeVisible();
    },
  );

  it('has no red bubble while there are seats left', async () => {
    renderAt('/', json([event]));

    await screen.findByRole('link', { name: 'Gala' });
    expect(screen.queryByText("Aucun billet n'est disponible")).toBeNull();
  });

  it('says so on the detail page, unless the participant holds a ticket', async () => {
    logInAs('PARTICIPANT');
    renderWithTickets('/events/e1', full, []);
    expect(
      await screen.findByText("Aucun billet n'est disponible"),
    ).toBeInTheDocument();
  });

  it('hides the red bubble on the detail page for the holder of a ticket', async () => {
    logInAs('PARTICIPANT');
    renderWithTickets('/events/e1', full, [heldTicket]);

    await screen.findByText(/Votre place est réservée/);
    expect(screen.queryByText("Aucun billet n'est disponible")).toBeNull();
  });
});

describe('check-in link', () => {
  it.each([
    ['an organizer of the event', true],
    ['another organizer', false],
  ])('is shown to %s: %s', async (_who, canManage) => {
    logInAs('ORGANIZER');
    renderAt('/events/e1', json({ ...event, canManage }));

    await screen.findByRole('heading', { name: 'Gala' });
    expect(!!screen.queryByRole('link', { name: 'Gérer le check-in' })).toBe(
      canManage,
    );
    expect(!!screen.queryByRole('link', { name: "Modifier l'événement" })).toBe(
      canManage,
    );
    expect(
      !!screen.queryByRole('button', { name: "Supprimer l'événement" }),
    ).toBe(canManage);
  });
});

describe('event deletion', () => {
  async function confirmDeletion(answer: Response) {
    logInAs('ORGANIZER');
    const fetch = renderAt('/events/e1', json({ ...event, canManage: true }));
    fetch.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'DELETE'
          ? answer
          : json({ ...event, canManage: true }),
      ),
    );
    render(<DialogHost />);
    await userEvent.click(
      await screen.findByRole('button', { name: "Supprimer l'événement" }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmer' }),
    );
    return fetch;
  }

  it('deletes the event after confirmation and goes back to the list', async () => {
    const fetch = await confirmDeletion(new Response(null, { status: 204 }));

    expect(await screen.findByText('Événement supprimé.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/e1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('explains in French why the event cannot be deleted', async () => {
    await confirmDeletion(
      json({ message: 'Event has tickets or volunteers' }, 409),
    );

    expect(
      await screen.findByText(/Des billets sont réservés/),
    ).toBeInTheDocument();
  });
});

describe('shifts link', () => {
  it.each([
    ['a volunteer of an organization of the event', true],
    ['a volunteer of another organization', false],
  ])('is shown to %s: %s', async (_who, canVolunteer) => {
    logInAs('VOLUNTEER');
    renderAt('/events/e1', json({ ...event, canVolunteer }));

    await screen.findByRole('heading', { name: 'Gala' });
    expect(!!screen.queryByRole('link', { name: 'Créneaux bénévoles' })).toBe(
      canVolunteer,
    );
  });
});

describe('EventDetailPage when the event changes', () => {
  it('ignores a slow answer for the event that was left', async () => {
    let release: (response: Response) => void = () => {};
    const slow = new Promise<Response>((resolve) => (release = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/events/e1'
          ? slow
          : Promise.resolve(json({ ...event, id: 'e2', title: 'Tournoi' })),
      ),
    );
    const router = createMemoryRouter(
      [{ path: '/events/:eventId', element: <EventDetailPage /> }],
      { initialEntries: ['/events/e1'] },
    );
    render(<RouterProvider router={router} />);

    await act(() => router.navigate('/events/e2'));
    expect(
      await screen.findByRole('heading', { name: 'Tournoi' }),
    ).toBeInTheDocument();

    await act(async () => release(json(event)));
    expect(
      screen.getByRole('heading', { name: 'Tournoi' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gala' })).toBeNull();
  });
});

describe('pages that read again after a booking or a cancellation', () => {
  // The event is read ok, then fails once (the booking bumps the version), then answers again
  function renderFlaky(path: string, ok: unknown) {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/me/tickets') return Promise.resolve(json([]));
        if (init?.method) return Promise.resolve(json({ id: 't1' }));
        reads += 1;
        return Promise.resolve(
          reads === 2 ? json({ message: 'Boom' }, 500) : json(ok),
        );
      }),
    );
    const router = createMemoryRouter(
      [
        { path: '/', element: <EventsPage /> },
        { path: '/events/:eventId', element: <EventDetailPage /> },
      ],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
  }

  it('lets the detail page recover after a transient failure', async () => {
    logInAs('PARTICIPANT');
    renderFlaky('/events/e1', event);
    expect(
      await screen.findByRole('heading', { name: 'Gala' }),
    ).toBeInTheDocument();

    await act(() => bookTicket('e1')); // version up: the read fails
    expect(await screen.findByText(/Boom/)).toBeInTheDocument();

    await act(() => cancelTicket('e1')); // version up again: the read answers
    expect(
      await screen.findByRole('heading', { name: 'Gala' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Boom/)).toBeNull();
  });

  it('lets the list recover after a transient failure', async () => {
    logInAs('PARTICIPANT');
    renderFlaky('/', [event]);
    expect(
      await screen.findByRole('link', { name: 'Gala' }),
    ).toBeInTheDocument();

    await act(() => bookTicket('e1'));
    expect(await screen.findByText(/Boom/)).toBeInTheDocument();

    await act(() => cancelTicket('e1'));
    expect(
      await screen.findByRole('link', { name: 'Gala' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Boom/)).toBeNull();
  });
});
