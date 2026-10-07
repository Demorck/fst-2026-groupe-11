import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PublicOrganizationView from './PublicOrganizationView.tsx';

const organization = {
  id: 'o1',
  name: 'BDE Nancy',
  description: 'Le bureau des étudiants',
  hasLogo: false,
  updatedAt: '2026-10-07T10:00:00.000Z',
  memberCount: 5,
  upcomingEvents: [
    {
      id: 'e1',
      title: 'Soirée de rentrée',
      startsAt: '2026-12-01T19:00:00.000Z',
      location: 'Nancy',
      category: 'PARTY',
      capacity: 100,
      remainingSeats: 40,
    },
    {
      id: 'e2',
      title: 'Gala',
      startsAt: '2026-12-10T19:00:00.000Z',
      location: 'Metz',
      category: 'PARTY',
      capacity: 10,
      remainingSeats: 0,
    },
  ],
};

function logInAs(role: string) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

/** `mine` answers `GET /organizations/mine`; the public page answers the rest. */
function stubApi(mine: object[] = [], publicStatus = 200) {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith('/mine')
        ? new Response(JSON.stringify(mine))
        : publicStatus === 200
          ? new Response(JSON.stringify(organization))
          : new Response(
              JSON.stringify({ message: 'Organization not found' }),
              {
                status: publicStatus,
              },
            ),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderView = () =>
  render(
    <MemoryRouter>
      <PublicOrganizationView organizationId="o1" />
    </MemoryRouter>,
  );

describe('PublicOrganizationView', () => {
  it('shows the organization and its upcoming events to a visitor, without any private call', async () => {
    const fetch = stubApi();
    renderView();

    expect(
      await screen.findByRole('heading', { name: 'BDE Nancy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 membre(s)')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Soirée de rentrée' }),
    ).toHaveAttribute('href', '/events/e1');
    expect(screen.getByText('40 place(s) restante(s)')).toBeInTheDocument();
    expect(screen.getByText('Complet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir tous ses événements' }),
    ).toHaveAttribute('href', '/?organization=o1');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/organizations/o1/public',
    ]);
    expect(screen.queryByRole('link', { name: /Gérer/ })).toBeNull();
  });

  it('offers the management page to a member only', async () => {
    logInAs('VOLUNTEER');
    stubApi([{ id: 'o1', role: 'VOLUNTEER' }]);
    renderView();

    expect(
      await screen.findByRole('link', { name: "Gérer l'organisation" }),
    ).toHaveAttribute('href', '/organizations/o1/manage');
  });

  it('does not offer it to someone who belongs to another organization', async () => {
    logInAs('ORGANIZER');
    stubApi([{ id: 'other', role: 'MANAGER' }]);
    renderView();

    await screen.findByRole('heading', { name: 'BDE Nancy' });

    expect(screen.queryByRole('link', { name: /Gérer/ })).toBeNull();
  });

  it('says so when the organization does not exist', async () => {
    stubApi([], 404);
    renderView();

    expect(
      await screen.findByText('Organisation introuvable.'),
    ).toBeInTheDocument();
  });
});
