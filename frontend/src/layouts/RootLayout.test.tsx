import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const stubInvitations = (count: number) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify(
          Array.from({ length: count }, (_, i) => ({ id: `i${i}` })),
        ),
      ),
    );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

beforeEach(() => {
  stubInvitations(0);
});

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

  it('shows the tickets link to a participant', () => {
    logIn('PARTICIPANT');
    renderLayout();

    expect(screen.getByRole('link', { name: 'Mes billets' })).toHaveAttribute(
      'href',
      '/me/tickets',
    );
  });

  it.each(['VOLUNTEER', 'ORGANIZER'])(
    'shows the tickets link to a %s, who inherits the participant rights',
    (role) => {
      logIn(role);
      renderLayout();

      expect(screen.getByRole('link', { name: 'Mes billets' })).toBeVisible();
    },
  );

  it('hides the tickets link when logged out', () => {
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Mes billets' })).toBeNull();
  });

  it.each([
    ['ORGANIZER', true],
    ['VOLUNTEER', true],
    ['PARTICIPANT', false],
  ])('shows the organizations link to a %s: %s', (role, shown) => {
    logIn(role);

    renderLayout();

    expect(
      screen.queryByRole('link', { name: 'Mes organisations' }) !== null,
    ).toBe(shown);
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

  describe('pending invitations badge', () => {
    it('shows how many invitations wait for an answer', async () => {
      stubInvitations(2);
      logIn('VOLUNTEER');
      renderLayout();

      expect(
        await screen.findByLabelText('2 invitation(s) en attente'),
      ).toHaveTextContent('2');
    });

    it('shows nothing when there is none', async () => {
      stubInvitations(0);
      logIn('VOLUNTEER');
      renderLayout();

      await screen.findByRole('link', { name: 'Mes organisations' });

      expect(screen.queryByLabelText(/invitation\(s\) en attente/)).toBeNull();
    });

    it('does not even ask the API for a participant', () => {
      const fetch = stubInvitations(3);
      logIn('PARTICIPANT');
      renderLayout();

      expect(fetch).not.toHaveBeenCalledWith(
        '/api/organizations/invitations',
        expect.anything(),
      );
      expect(screen.queryByLabelText(/invitation\(s\) en attente/)).toBeNull();
    });

    it('shows nothing when the API fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      logIn('ORGANIZER');
      renderLayout();

      await screen.findByRole('link', { name: 'Mes organisations' });

      expect(screen.queryByLabelText(/invitation\(s\) en attente/)).toBeNull();
    });
  });
});
