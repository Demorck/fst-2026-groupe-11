import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage.tsx';
import RegisterPage from './RegisterPage.tsx';

const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role: 'ORGANIZER' };

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Accueil</p> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe.each(['/login', '/register'])('%s when logged in', (path) => {
  it('redirects to the home page', () => {
    localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));

    const router = renderAt(path);

    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('LoginPage', () => {
  it('redirects to the home page after a successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ accessToken: 't', user })),
        ),
    );
    renderAt('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.fr');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Accueil')).toBeInTheDocument();
  });

  it('shows the API error on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid credentials' }), {
          status: 401,
        }),
      ),
    );
    renderAt('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.fr');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid credentials',
    );
  });
});
