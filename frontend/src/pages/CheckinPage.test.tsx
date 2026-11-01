import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import CheckinPage from './CheckinPage.tsx';

function renderPage(response: Response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const router = createMemoryRouter(
    [{ path: '/events/:eventId/checkin', element: <CheckinPage /> }],
    { initialEntries: ['/events/e1/checkin'] },
  );
  render(<RouterProvider router={router} />);
}

describe('CheckinPage', () => {
  it('opens for the organizers of the event', async () => {
    renderPage(new Response(JSON.stringify({ id: 'e1', canManage: true })));

    expect(
      await screen.findByRole('heading', { name: 'Check-in' }),
    ).toBeInTheDocument();
  });

  it('is refused to the other organizers', async () => {
    renderPage(new Response(JSON.stringify({ id: 'e1', canManage: false })));

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
  });

  it('is refused when the event cannot be read', async () => {
    renderPage(new Response('{}', { status: 404 }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
  });

  it('tells a server failure from a refusal, and offers to try again', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url === '/api/events/e1'
          ? fetch.mock.calls.length === 1
            ? new Response(JSON.stringify({ message: 'Boom' }), { status: 500 })
            : new Response(JSON.stringify({ id: 'e1', canManage: true }))
          : new Response('[]'),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const router = createMemoryRouter(
      [{ path: '/events/:eventId/checkin', element: <CheckinPage /> }],
      { initialEntries: ['/events/e1/checkin'] },
    );
    render(<RouterProvider router={router} />);

    // the English message of the API is not shown
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Impossible de charger l'événement, réessayez plus tard.",
    );
    expect(screen.queryByText(/Boom/)).toBeNull();
    expect(screen.queryByText(/Accès refusé/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('heading', { name: 'Check-in' }),
    ).toBeInTheDocument();
  });
});
