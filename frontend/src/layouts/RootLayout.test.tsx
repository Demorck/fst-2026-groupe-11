import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import RootLayout from './RootLayout.tsx';

const logIn = (role: string) =>
  localStorage.setItem(
    'session',
    JSON.stringify({
      accessToken: 'token',
      user: { id: 'u1', email: 'a@b.fr', name: 'Alice', role },
    }),
  );

const renderLayout = () =>
  render(
    <MemoryRouter>
      <RootLayout />
    </MemoryRouter>,
  );

describe('RootLayout header', () => {
  it('shows the login link when logged out', () => {
    renderLayout();

    expect(screen.getByRole('link', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Déconnexion' })).toBeNull();
  });

  it('replaces the login link with a profile link named after the user', () => {
    logIn('ORGANIZER');

    renderLayout();

    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.queryByRole('link', { name: 'Connexion' })).toBeNull();
  });

  it('shows the organizer links to an organizer', () => {
    logIn('ORGANIZER');

    renderLayout();

    expect(
      screen.getByRole('link', { name: 'Créer un événement' }),
    ).toHaveAttribute('href', '/events/new');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it.each(['PARTICIPANT', 'VOLUNTEER'])(
    'hides the organizer links from a %s',
    (role) => {
      logIn(role);

      renderLayout();

      expect(screen.getByRole('link', { name: 'Événements' })).toBeVisible();
      expect(
        screen.queryByRole('link', { name: 'Créer un événement' }),
      ).toBeNull();
      expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    },
  );

  it.each(['PARTICIPANT', 'VOLUNTEER', 'ORGANIZER'])(
    'shows the tickets link to a %s',
    (role) => {
      logIn(role);
      renderLayout();

      expect(screen.getByRole('link', { name: 'Mes billets' })).toHaveAttribute(
        'href',
        '/me/tickets',
      );
    },
  );

  it('hides the tickets link when logged out', () => {
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Mes billets' })).toBeNull();
  });

  it('hides the organizer links when logged out', () => {
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('logs out on click and goes back to the login link', async () => {
    logIn('ORGANIZER');
    renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(screen.getByRole('link', { name: 'Connexion' })).toBeInTheDocument();
    expect(localStorage.getItem('session')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });
});
