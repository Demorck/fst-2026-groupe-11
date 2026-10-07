import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import VolunteerShiftsPage from './VolunteerShiftsPage.tsx';

const shift = {
  title: 'Bar',
  startsAt: '2026-12-01T19:00:00.000Z',
  endsAt: '2026-12-01T21:00:00.000Z',
  eventId: 'e1',
};

const shifts = [
  { ...shift, id: 's1', requiredVolunteers: 3, registered: 2, assigned: true },
  {
    ...shift,
    id: 's2',
    title: 'Accueil',
    requiredVolunteers: 1,
    registered: 1,
    assigned: false,
  },
];

function logInAs(role: string) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/events/:eventId/shifts', element: <VolunteerShiftsPage /> }],
    { initialEntries: ['/events/e1/shifts'] },
  );
  render(<RouterProvider router={router} />);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('VolunteerShiftsPage', () => {
  it('lists the shifts with the coverage and highlights mine', async () => {
    logInAs('VOLUNTEER');
    const fetch = vi.fn().mockResolvedValue(json(shifts));
    vi.stubGlobal('fetch', fetch);

    renderPage();

    expect(await screen.findByText('Bar')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/events/e1/shifts');
    expect(screen.getByText('2 / 3 bénévoles')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 bénévoles')).toBeInTheDocument();
    // only my shift carries the registered mark
    expect(screen.getAllByText('Vous êtes inscrit')).toHaveLength(1);
  });

  it('hides the organizer actions from a volunteer', async () => {
    logInAs('VOLUNTEER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(shifts)));

    renderPage();

    await screen.findByText('Bar');
    expect(screen.queryByRole('button', { name: /Ajouter/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Modifier/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Supprimer/ })).toBeNull();
  });

  it('says so when the event has no shift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));

    renderPage();

    expect(
      await screen.findByText('Aucun créneau pour cet événement.'),
    ).toBeInTheDocument();
  });

  it('shows the API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ message: 'Event not found' }, 404)),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Event not found',
    );
  });
});

describe('VolunteerShiftsPage sign-up', () => {
  const join = () => screen.findByRole('button', { name: "S'inscrire" });
  const leave = () => screen.findByRole('button', { name: 'Se désinscrire' });

  it('shows the right button on each shift', async () => {
    logInAs('VOLUNTEER');
    const open = {
      ...shifts[0],
      id: 's3',
      title: 'Vestiaire',
      assigned: false,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([...shifts, open])));

    renderPage();

    // s1 is mine, s2 is full, s3 is open
    expect(await leave()).toBeVisible();
    expect(screen.getByRole('button', { name: 'Complet' })).toBeDisabled();
    expect(await join()).toBeVisible();
  });

  it('signs up and reloads the list', async () => {
    logInAs('VOLUNTEER');
    const open = { ...shifts[0], assigned: false, registered: 1 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([open]))
      .mockResolvedValueOnce(json({ id: 'a1' }, 201))
      .mockResolvedValueOnce(
        json([{ ...open, assigned: true, registered: 2 }]),
      );
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await userEvent.click(await join());

    expect(await screen.findByText('2 / 3 bénévoles')).toBeInTheDocument();
    expect(await leave()).toBeVisible();
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1/assignments');
    expect(init.method).toBe('POST');
  });

  it('signs out of my shift', async () => {
    logInAs('VOLUNTEER');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([shifts[0]]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        json([{ ...shifts[0], assigned: false, registered: 1 }]),
      );
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await userEvent.click(await leave());

    expect(await join()).toBeVisible();
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1/assignments');
    expect(init.method).toBe('DELETE');
  });

  it.each([
    ['Shift is full', 'Ce créneau est complet.'],
    [
      'Overlaps another of your shifts',
      'Ce créneau chevauche un autre de vos créneaux.',
    ],
  ])('translates the "%s" refusal', async (message, text) => {
    logInAs('VOLUNTEER');
    const open = { ...shifts[0], assigned: false };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json([open]))
        .mockResolvedValueOnce(json({ message }, 409))
        .mockResolvedValueOnce(json([open])),
    );
    renderPage();

    await userEvent.click(await join());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('offers no sign-up to an organizer', async () => {
    logInAs('ORGANIZER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(shifts)));

    renderPage();

    await screen.findByText('Bar');
    expect(screen.queryByRole('button', { name: "S'inscrire" })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Se désinscrire' })).toBeNull();
  });
});

describe('VolunteerShiftsPage as organizer', () => {
  it('creates a shift and reloads the list', async () => {
    logInAs('ORGANIZER');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ id: 's3' }))
      .mockResolvedValueOnce(json(shifts));
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /Ajouter un créneau/ }),
    );
    await userEvent.type(screen.getByLabelText('Intitulé'), 'Bar');
    fireEvent.change(screen.getByLabelText('Début'), {
      target: { value: '2026-12-01T19:00' },
    });
    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-12-01T21:00' },
    });
    await userEvent.type(screen.getByLabelText('Bénévoles requis'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('2 / 3 bénévoles')).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/events/e1/shifts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Bar',
      startsAt: new Date('2026-12-01T19:00').toISOString(),
      endsAt: new Date('2026-12-01T21:00').toISOString(),
      requiredVolunteers: 3,
    });
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('refuses an end before the start without calling the API', async () => {
    logInAs('ORGANIZER');
    const fetch = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /Ajouter un créneau/ }),
    );
    await userEvent.type(screen.getByLabelText('Intitulé'), 'Bar');
    fireEvent.change(screen.getByLabelText('Début'), {
      target: { value: '2026-12-01T21:00' },
    });
    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-12-01T19:00' },
    });
    await userEvent.type(screen.getByLabelText('Bénévoles requis'), '3');
    // bypass the native min check so the submit handler runs
    screen.getByLabelText('Fin').removeAttribute('min');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fin doit être après le début.',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('edits a shift with the current values prefilled', async () => {
    logInAs('ORGANIZER');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(shifts))
      .mockResolvedValueOnce(json({ id: 's1' }))
      .mockResolvedValueOnce(json(shifts));
    vi.stubGlobal('fetch', fetch);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Modifier Bar' }),
    );
    const title = screen.getByLabelText('Intitulé');
    expect(title).toHaveValue('Bar');
    await userEvent.clear(title);
    await userEvent.type(title, 'Bar sans alcool');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toMatchObject({
      title: 'Bar sans alcool',
      requiredVolunteers: 3,
    });
  });

  it('deletes a shift after a confirmation', async () => {
    logInAs('ORGANIZER');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(shifts))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json([shifts[1]]));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer Bar' }),
    );

    await vi.waitFor(() => expect(screen.queryByText('Bar')).toBeNull());
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1');
    expect(init.method).toBe('DELETE');
  });

  it('keeps the shift when the deletion is not confirmed', async () => {
    logInAs('ORGANIZER');
    const fetch = vi.fn().mockResolvedValue(json(shifts));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer Bar' }),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Bar')).toBeInTheDocument();
  });

  it('shows the API refusal on a deletion', async () => {
    logInAs('ORGANIZER');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(shifts))
        .mockResolvedValueOnce(json({ message: 'Not the organizer' }, 403)),
    );
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer Bar' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not the organizer',
    );
  });
});
