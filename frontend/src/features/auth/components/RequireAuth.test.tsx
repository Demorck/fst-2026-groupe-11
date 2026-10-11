import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../types.ts';
import RequireAuth from './RequireAuth.tsx';

function logInAs(role: Role) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Connexion</p> },
      {
        element: <RequireAuth />,
        children: [{ path: '/profile', element: <p>Profil</p> }],
      },
      {
        element: <RequireAuth roles={['ORGANIZER']} />,
        children: [{ path: '/events/new', element: <p>Créer</p> }],
      },
      {
        element: <RequireAuth roles={['VOLUNTEER']} />,
        children: [{ path: '/shifts', element: <p>Créneaux</p> }],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('RequireAuth', () => {
  it('redirects to /login when logged out', () => {
    const router = renderAt('/events/new');

    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the page to any logged in user when no role is required', () => {
    logInAs('PARTICIPANT');
    renderAt('/profile');

    expect(screen.getByText('Profil')).toBeInTheDocument();
  });

  it('shows the page to an allowed role', () => {
    logInAs('ORGANIZER');
    renderAt('/events/new');

    expect(screen.getByText('Créer')).toBeInTheDocument();
  });

  it('shows an access denied message to other roles', () => {
    logInAs('VOLUNTEER');
    const router = renderAt('/events/new');

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(
      screen.getByText(/réservée au rôle Organisateur/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Créer')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/events/new');
  });

  it('names every role that gets in, since higher roles inherit the minimum', () => {
    logInAs('PARTICIPANT');
    renderAt('/shifts');

    expect(
      screen.getByText(/réservée au rôle Bénévole ou Organisateur/),
    ).toBeInTheDocument();
  });

  it('lets an organizer into a volunteer page', () => {
    logInAs('ORGANIZER');
    renderAt('/shifts');

    expect(screen.getByText('Créneaux')).toBeInTheDocument();
  });
});
