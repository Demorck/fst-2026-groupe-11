import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import RootLayout from './RootLayout.tsx';

const session = {
  accessToken: 'token',
  user: { id: 'u1', email: 'a@b.fr', name: 'Alice', role: 'ORGANIZER' },
};

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
  });

  it('replaces the login link with a profile link named after the user', () => {
    localStorage.setItem('session', JSON.stringify(session));

    renderLayout();

    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.queryByRole('link', { name: 'Connexion' })).toBeNull();
  });
});
