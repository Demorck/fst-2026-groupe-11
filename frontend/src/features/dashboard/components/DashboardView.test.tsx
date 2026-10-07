import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import DashboardView from './DashboardView.tsx';

const org = (id: string, name: string) => ({
  id,
  name,
  description: null,
  hasLogo: false,
  updatedAt: '2026-10-07T10:00:00.000Z',
});
const indicators = (id: string, title: string, overrides: object = {}) => ({
  id,
  title,
  startsAt: '2026-12-01T19:00:00.000Z',
  endsAt: '2026-12-01T23:00:00.000Z',
  location: 'Nancy',
  category: 'PARTY',
  capacity: 40,
  organizations: [org('o1', 'BDE')],
  reserved: 30,
  fillRate: 0.75,
  checkedIn: 12,
  volunteers: { required: 5, registered: 5, missing: 0 },
  risks: { lowFill: false, incompleteShifts: false },
  ...overrides,
});

const managed = [
  { ...org('o1', 'BDE'), role: 'MANAGER' },
  { ...org('o2', 'Sport'), role: 'MANAGER' },
];

/** Routes the dashboard, the event stats and anything else. */
function stubApi(events: object[], organizations: object[] = managed) {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          url.includes('/stats')
            ? {
                ...indicators('e1', 'Gala'),
                shifts: [
                  {
                    id: 's1',
                    title: 'Accueil',
                    startsAt: '2026-12-01T18:00:00.000Z',
                    endsAt: '2026-12-01T20:00:00.000Z',
                    requiredVolunteers: 3,
                    registered: 1,
                  },
                ],
              }
            : { organizations, events },
        ),
      ),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderView = () =>
  render(
    <MemoryRouter>
      <DashboardView />
    </MemoryRouter>,
  );

describe('DashboardView', () => {
  it('shows registrations, fill rate, attendance and volunteers of each event', async () => {
    stubApi([indicators('e1', 'Gala')]);
    renderView();

    const row = (await screen.findByRole('link', { name: 'Gala' })).closest(
      'tr',
    ) as HTMLElement;

    expect(within(row).getByText(/30 \/ 40/)).toHaveTextContent('75 %');
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('5 / 5')).toBeInTheDocument();
    expect(within(row).getByText('Rien à signaler')).toBeInTheDocument();
    expect(row).toHaveAttribute('data-at-risk', 'false');
  });

  it('highlights the events at risk and says why', async () => {
    stubApi([
      indicators('e1', 'Gala', {
        risks: { lowFill: true, incompleteShifts: true },
      }),
      indicators('e2', 'Atelier'),
    ]);
    renderView();

    const risky = (await screen.findByRole('link', { name: 'Gala' })).closest(
      'tr',
    ) as HTMLElement;
    const calm = screen.getByRole('link', { name: 'Atelier' }).closest('tr');

    expect(risky).toHaveAttribute('data-at-risk', 'true');
    expect(risky).toHaveClass('bg-amber-50');
    expect(within(risky).getByText('Peu rempli')).toBeInTheDocument();
    expect(within(risky).getByText('Créneaux incomplets')).toBeInTheDocument();
    expect(calm).toHaveAttribute('data-at-risk', 'false');
  });

  it('shows a dash when an event has no shift', async () => {
    stubApi([
      indicators('e1', 'Gala', {
        volunteers: { required: 0, registered: 0, missing: 0 },
      }),
    ]);
    renderView();

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('filters on one organization through the selector', async () => {
    const fetch = stubApi([indicators('e1', 'Gala')]);
    renderView();
    await screen.findByRole('link', { name: 'Gala' });

    await userEvent.selectOptions(screen.getByLabelText('Organisation'), 'o2');

    await vi.waitFor(() =>
      expect(fetch.mock.calls.map(([url]) => url)).toContain(
        '/api/dashboard?organizationId=o2',
      ),
    );
    expect(fetch.mock.calls[0][0]).toBe('/api/dashboard');
    expect(
      screen.getByRole('option', { name: 'Toutes mes organisations' }),
    ).toBeInTheDocument();
  });

  it('opens the shift by shift detail of an event', async () => {
    const fetch = stubApi([indicators('e1', 'Gala')]);
    renderView();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Détail de Gala' }),
    );

    expect(await screen.findByText('1 / 3 bénévoles')).toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toContain(
      '/api/events/e1/stats',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Détail de Gala' }),
    );
    expect(screen.queryByText('1 / 3 bénévoles')).toBeNull();
  });

  it('says so when no event needs following', async () => {
    stubApi([]);
    renderView();

    expect(
      await screen.findByText('Aucun événement à suivre pour le moment.'),
    ).toBeInTheDocument();
  });

  it('sends a user without organization to the organizations page', async () => {
    stubApi([], []);
    renderView();

    expect(
      await screen.findByRole('link', { name: 'Gérer mes organisations' }),
    ).toHaveAttribute('href', '/organizations');
  });

  it('shows the API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
        }),
      ),
    );
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });
});
