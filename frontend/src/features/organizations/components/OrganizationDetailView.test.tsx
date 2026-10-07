import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import OrganizationDetailView from './OrganizationDetailView.tsx';

const detail = (role: 'MANAGER' | 'VOLUNTEER') => ({
  id: 'o1',
  name: 'BDE Nancy',
  description: 'Le bureau des étudiants',
  hasLogo: false,
  updatedAt: '2026-10-07T10:00:00.000Z',
  role,
  members: [
    {
      id: 'm1',
      role: 'MANAGER',
      status: 'ACCEPTED',
      user: {
        id: 'u1',
        name: 'Océane',
        ...(role === 'MANAGER' && { email: 'o@x.fr' }),
      },
    },
    {
      id: 'm2',
      role: 'VOLUNTEER',
      status: 'PENDING',
      user: { id: 'u2', name: 'Basile', email: 'b@x.fr' },
    },
  ],
});

function stubApi(
  role: 'MANAGER' | 'VOLUNTEER',
  post = () => new Response('{}'),
) {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method ? post() : new Response(JSON.stringify(detail(role))),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderView = () =>
  render(
    <MemoryRouter>
      <OrganizationDetailView organizationId="o1" />
    </MemoryRouter>,
  );

describe('OrganizationDetailView', () => {
  it('gives a manager the members with their e-mail, the logo upload and the invitation form', async () => {
    stubApi('MANAGER');
    renderView();

    expect(
      await screen.findByRole('heading', { name: 'BDE Nancy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('o@x.fr')).toBeInTheDocument();
    expect(screen.getByText('Invitation en attente')).toBeInTheDocument();
    expect(screen.getByLabelText(/Logo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeInTheDocument();
  });

  it('gives a volunteer a read-only view', async () => {
    stubApi('VOLUNTEER');
    renderView();

    await screen.findByRole('heading', { name: 'BDE Nancy' });

    expect(screen.queryByLabelText(/Logo/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inviter' })).toBeNull();
    expect(screen.getByText('Votre rôle : bénévole')).toBeInTheDocument();
  });

  it('sends the invitation and confirms it', async () => {
    const fetch = stubApi('MANAGER');
    renderView();

    await userEvent.type(await screen.findByLabelText('E-mail'), 'b@x.fr');
    await userEvent.click(screen.getByRole('button', { name: 'Inviter' }));

    expect(await screen.findByRole('status')).toHaveTextContent('b@x.fr');
    const [, init] = fetch.mock.calls.find(([url]) =>
      url.endsWith('/invitations'),
    ) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'b@x.fr' });
  });

  it('translates the refusal of an invitation', async () => {
    stubApi(
      'MANAGER',
      () =>
        new Response(JSON.stringify({ message: 'Already a member' }), {
          status: 409,
        }),
    );
    renderView();

    await userEvent.type(await screen.findByLabelText('E-mail'), 'b@x.fr');
    await userEvent.click(screen.getByRole('button', { name: 'Inviter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette personne est déjà membre.',
    );
  });

  it('uploads the logo as raw bytes with the file type', async () => {
    const fetch = stubApi('MANAGER');
    renderView();
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
      type: 'image/png',
    });

    await userEvent.upload(await screen.findByLabelText(/Logo/), file);

    await vi.waitFor(() => {
      const call = fetch.mock.calls.find(([url]) => url.endsWith('/logo'));
      const init = call?.[1] as RequestInit;
      expect(init.method).toBe('PUT');
      expect(init.body).toBe(file);
      expect(init.headers).toMatchObject({ 'Content-Type': 'image/png' });
    });
  });

  it('refuses a logo over 512 KB without calling the API', async () => {
    const fetch = stubApi('MANAGER');
    renderView();
    const big = new File([new Uint8Array(513 * 1024)], 'big.png', {
      type: 'image/png',
    });

    await userEvent.upload(await screen.findByLabelText(/Logo/), big);

    expect(await screen.findByRole('alert')).toHaveTextContent('512 Ko');
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/logo'))).toBe(false);
  });

  it('shows the API refusal for an organization the user cannot see', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: 'Not a member of this organization' }),
            { status: 403 },
          ),
        ),
    );
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous n’êtes pas membre de cette organisation.',
    );
  });
});
