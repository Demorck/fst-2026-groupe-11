import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import CreateEventPage from './CreateEventPage.tsx';

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
  await userEvent.type(screen.getByLabelText('Titre'), 'Gala');
  await userEvent.type(screen.getByLabelText('Description'), 'Soirée');
  // user-event can't type into datetime-local inputs in jsdom
  fireEvent.change(screen.getByLabelText('Début'), {
    target: { value: startsAt },
  });
  fireEvent.change(screen.getByLabelText('Fin'), { target: { value: endsAt } });
  await userEvent.type(screen.getByLabelText('Lieu'), 'Nancy');
  await userEvent.type(screen.getByLabelText('Capacité'), '50');
  await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'PARTY');
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: "Créer l'événement" }));

describe('CreateEventPage', () => {
  it('posts the event and redirects to its detail page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'e1' })));
    vi.stubGlobal('fetch', fetch);
    const router = renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await submit();

    expect(await screen.findByText('Détail')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/events/e1');
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/events');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Gala',
      description: 'Soirée',
      startsAt: new Date('2026-12-01T19:00').toISOString(),
      endsAt: new Date('2026-12-01T23:00').toISOString(),
      location: 'Nancy',
      capacity: 50,
      category: 'PARTY',
    });
  });

  it('refuses an end date before the start without calling the API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T19:00');
    // bypass the native min check so the submit handler runs
    screen.getByLabelText('Fin').removeAttribute('min');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fin doit être après le début.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: ['capacity must be ...'] }), {
          status: 400,
        }),
      ),
    );
    renderPage();

    await fillForm('2026-12-01T19:00', '2026-12-01T23:00');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'capacity must be ...',
    );
  });
});
