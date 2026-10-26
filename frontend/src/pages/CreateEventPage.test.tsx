import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import CreateEventPage from './CreateEventPage.tsx';

const bde = { id: 'o1', name: 'BDE', role: 'MANAGER' };
const sport = { id: 'o2', name: 'Club Sport', role: 'MANAGER' };
const volunteerOf = { id: 'o3', name: 'Autre asso', role: 'VOLUNTEER' };

/** Answers `GET /organizations/mine`, and every other call with `answer`. */
function stubApi(organizations: object[], answer: () => Response) {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      url === '/api/organizations/mine'
        ? new Response(JSON.stringify(organizations))
        : answer(),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const eventCalls = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([url]) => url === '/api/events') as [
    string,
    RequestInit,
  ][];

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/events/new', element: <CreateEventPage /> },
      { path: '/events/:eventId', element: <p>Détail</p> },
    ],
    { initialEntries: ['/events/new'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function fillForm(startsAt: string, endsAt: string) {
  await screen.findByLabelText('Titre');
  await userEvent.type(screen.getByLabelText('Titre'), 'Gala');
  await userEvent.type(screen.getByLabelText('Description'), 'Soirée');
  // user-event can't type into datetime-local inputs in jsdom
  fireEvent.change(screen.getByLabelText('Début'), {
    target: { value: startsAt },
  });
  fireEvent.change(screen.getByLabelText('Fin'), { target: { value: endsAt } });
  await userEvent.type(screen.getByLabelText('Lieu'), 'Nancy');
  await userEvent.type(screen.getByLabelText('Capacité'), '50');
  await userEvent.click(screen.getByRole('radio', { name: 'Soirée' }));
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: "Créer l'événement" }));

describe('CreateEventPage', () => {
  it('posts the event and redirects to its detail page', async () => {
    const fetch = stubApi(
      [bde],
      () => new Response(JSON.stringify({ id: 'e1' })),
    );
    const router = renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await submit();

    expect(await screen.findByText('Détail')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/events/e1');
    const [[url, init]] = eventCalls(fetch);
    expect(url).toBe('/api/events');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Gala',
      description: 'Soirée',
      startsAt: new Date('2026-12-01T19:00').toISOString(),
      endsAt: new Date('2026-12-01T23:00').toISOString(),
      location: 'Nancy',
      capacity: 50,
      category: 'PARTY',
      organizationIds: ['o1'],
    });
  });

  it('estimates the attendance once the date and the capacity are filled', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url === '/api/organizations/mine'
              ? [bde]
              : {
                  estimate: 38,
                  fillRate: 0.76,
                  confidence: 'LOW',
                  sampleSize: 1,
                  warning: null,
                },
          ),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');

    expect(await screen.findByText(/environ 38 billets/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/attendance-prediction',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends every organization that is ticked', async () => {
    const fetch = stubApi(
      [bde, sport, volunteerOf],
      () => new Response(JSON.stringify({ id: 'e1' })),
    );
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await userEvent.click(screen.getByRole('checkbox', { name: 'BDE' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Club Sport' }));
    await submit();

    await screen.findByText('Détail');
    const [[, init]] = eventCalls(fetch);
    expect(JSON.parse(init.body as string).organizationIds).toEqual([
      'o1',
      'o2',
    ]);
  });

  it('only offers the organizations the user manages', async () => {
    stubApi([bde, volunteerOf], () => new Response('{}'));
    renderPage();

    await screen.findByLabelText('Titre');

    expect(screen.getByRole('checkbox', { name: 'BDE' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Autre asso' })).toBeNull();
  });

  it('refuses to submit without any organization ticked', async () => {
    const fetch = stubApi([bde, sport], () => new Response('{}'));
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choisissez au moins une organisation.',
    );
    expect(eventCalls(fetch)).toHaveLength(0);
  });

  it.each([[[]], [[volunteerOf]]])(
    'blocks the creation for a user who manages no organization (%j)',
    async (organizations) => {
      stubApi(organizations, () => new Response('{}'));
      renderPage();

      expect(
        await screen.findByText(/ne gérez aucune organisation/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Gérer mes organisations' }),
      ).toHaveAttribute('href', '/organizations');
      expect(screen.queryByLabelText('Titre')).toBeNull();
    },
  );

  it('refuses an end date before the start without calling the API', async () => {
    const fetch = stubApi([bde], () => new Response('{}'));
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T19:00');
    // bypass the native min check so the submit handler runs
    screen.getByLabelText('Fin').removeAttribute('min');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fin doit être après le début.',
    );
    expect(eventCalls(fetch)).toHaveLength(0);
  });

  it('shows the API error', async () => {
    stubApi(
      [bde],
      () =>
        new Response(JSON.stringify({ message: ['capacity must be ...'] }), {
          status: 400,
        }),
    );
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'capacity must be ...',
    );
  });
});
