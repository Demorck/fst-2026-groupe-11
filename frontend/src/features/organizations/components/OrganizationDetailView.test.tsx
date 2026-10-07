import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import OrganizationDetailView from './OrganizationDetailView.tsx';

const SELF = { id: 'u1', email: 'o@x.fr', name: 'Océane', role: 'ORGANIZER' };

function logIn(user = SELF) {
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

const member = (
  id: string,
  userId: string,
  name: string,
  role: string,
  status: string,
  extra: object = {},
) => ({
  id,
  role,
  status,
  user: { id: userId, name, email: `${userId}@x.fr` },
  ...extra,
});

const detail = (role: 'MANAGER' | 'VOLUNTEER') => ({
  id: 'o1',
  name: 'BDE Nancy',
  description: 'Le bureau des étudiants',
  hasLogo: false,
  updatedAt: '2026-10-07T10:00:00.000Z',
  role,
  members: [
    member('m1', 'u1', 'Océane', 'MANAGER', 'ACCEPTED'),
    member('m2', 'u2', 'Bastien', 'VOLUNTEER', 'ACCEPTED'),
    member('m3', 'u3', 'Basile', 'VOLUNTEER', 'PENDING'),
    member('m4', 'u4', 'Béatrice', 'VOLUNTEER', 'PENDING', { expired: true }),
  ],
});

const hours = [
  { userId: 'u2', name: 'Bastien', status: 'ACCEPTED', shifts: 2, hours: 4 },
  { userId: 'u5', name: 'Bérénice', status: 'LEFT', shifts: 1, hours: 2 },
];
const audit = [
  {
    id: 'a1',
    action: 'MEMBER_REMOVED',
    createdAt: '2026-10-01T10:00:00.000Z',
    actor: { id: 'u1', name: 'Océane' },
    target: { id: 'u9', name: 'Bruno' },
    details: { removedShifts: 2 },
  },
];

/** Routes the calls of the page; `post` answers every write. */
function stubApi(
  role: 'MANAGER' | 'VOLUNTEER',
  post = () => new Response('{}'),
) {
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method) return Promise.resolve(post());
    const body = url.endsWith('/hours')
      ? hours
      : url.endsWith('/audit')
        ? audit
        : detail(role);
    return Promise.resolve(new Response(JSON.stringify(body)));
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const writes = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([, init]) => init?.method) as [
    string,
    RequestInit,
  ][];

function renderView() {
  const router = createMemoryRouter(
    [
      {
        path: '/organizations/:organizationId/manage',
        element: <OrganizationDetailView organizationId="o1" />,
      },
      { path: '/organizations', element: <p>Mes organisations</p> },
    ],
    { initialEntries: ['/organizations/o1/manage'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const row = (name: string) =>
  screen.getByText(name).closest('li') as HTMLElement;

describe('OrganizationDetailView', () => {
  it('gives a manager the members, hours, journal, logo upload and invitation form', async () => {
    logIn();
    stubApi('MANAGER');
    renderView();

    expect(
      await screen.findByRole('heading', { name: 'BDE Nancy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('u2@x.fr')).toBeInTheDocument();
    expect(screen.getByLabelText(/Logo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeInTheDocument();
    expect(
      await screen.findByText(/Océane a retiré Bruno de l'organisation/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 créneau\(x\) à venir retiré/),
    ).toBeInTheDocument();
  });

  it('gives a volunteer a read-only view of the members, and their hours', async () => {
    logIn({ ...SELF, id: 'u2', role: 'VOLUNTEER' });
    stubApi('VOLUNTEER');
    renderView();

    await screen.findByRole('heading', { name: 'BDE Nancy' });

    expect(screen.queryByLabelText(/Logo/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inviter' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Journal' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Retirer/ })).toBeNull();
    expect(await screen.findByText('4 h')).toBeInTheDocument();
  });

  it('links each hours row to its attestation', async () => {
    logIn();
    stubApi('MANAGER');
    renderView();

    expect(
      await screen.findByRole('link', { name: 'Attestation de Bastien' }),
    ).toHaveAttribute('href', '/organizations/o1/attestation/u2');
    expect(screen.getByText('(parti)')).toBeInTheDocument();
  });

  it('removes a member only after a confirmation, then reloads', async () => {
    logIn();
    const fetch = stubApi('MANAGER');
    renderView();
    await screen.findByRole('heading', { name: 'BDE Nancy' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Retirer Bastien' }),
    );
    expect(writes(fetch)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => expect(writes(fetch)).toHaveLength(1));
    const [url, init] = writes(fetch)[0];
    expect(url).toBe('/api/organizations/o1/members/m2');
    expect(init.method).toBe('DELETE');
  });

  it('does not offer to remove oneself', async () => {
    logIn();
    stubApi('MANAGER');
    renderView();
    await screen.findByRole('heading', { name: 'BDE Nancy' });

    expect(
      within(row('Océane')).queryByRole('button', { name: /Retirer/ }),
    ).toBeNull();
  });

  it('cancels a pending invitation, and tags an expired one', async () => {
    logIn();
    const fetch = stubApi('MANAGER');
    renderView();
    await screen.findByRole('heading', { name: 'BDE Nancy' });

    expect(
      within(row('Béatrice')).getByText('Invitation expirée'),
    ).toBeInTheDocument();
    expect(
      within(row('Basile')).getByText('Invitation en attente'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: "Annuler l'invitation de Basile" }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() =>
      expect(writes(fetch)[0][0]).toBe('/api/organizations/o1/invitations/m3'),
    );
  });

  it('leaves the organization and goes back to the list', async () => {
    logIn();
    const fetch = stubApi('MANAGER');
    const router = renderView();
    await screen.findByRole('heading', { name: 'BDE Nancy' });

    await userEvent.click(
      screen.getByRole('button', { name: "Quitter l'organisation" }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Mes organisations')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/organizations');
    expect(writes(fetch)[0][0]).toBe('/api/organizations/o1/leave');
  });

  it('translates the refusal for the last manager', async () => {
    logIn();
    stubApi(
      'MANAGER',
      () =>
        new Response(
          JSON.stringify({ message: 'Last manager of the organization' }),
          { status: 409 },
        ),
    );
    renderView();
    await screen.findByRole('heading', { name: 'BDE Nancy' });

    await userEvent.click(
      screen.getByRole('button', { name: "Quitter l'organisation" }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'dernier gestionnaire',
    );
    expect(
      screen.getByRole('heading', { name: 'BDE Nancy' }),
    ).toBeInTheDocument();
  });

  it('sends the invitation and confirms it', async () => {
    logIn();
    const fetch = stubApi('MANAGER');
    renderView();

    await userEvent.type(await screen.findByLabelText('E-mail'), 'b@x.fr');
    await userEvent.click(screen.getByRole('button', { name: 'Inviter' }));

    expect(await screen.findByRole('status')).toHaveTextContent('b@x.fr');
    const [, init] = writes(fetch).find(([url]) =>
      url.endsWith('/invitations'),
    ) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'b@x.fr' });
  });

  it('translates the refusal of an invitation', async () => {
    logIn();
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
    logIn();
    const fetch = stubApi('MANAGER');
    renderView();
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
      type: 'image/png',
    });

    await userEvent.upload(await screen.findByLabelText(/Logo/), file);

    await vi.waitFor(() => {
      const call = writes(fetch).find(([url]) => url.endsWith('/logo'));
      expect(call?.[1].method).toBe('PUT');
      expect(call?.[1].body).toBe(file);
      expect(call?.[1].headers).toMatchObject({ 'Content-Type': 'image/png' });
    });
  });

  it('refuses a logo over 512 KB without calling the API', async () => {
    logIn();
    const fetch = stubApi('MANAGER');
    renderView();
    const big = new File([new Uint8Array(513 * 1024)], 'big.png', {
      type: 'image/png',
    });

    await userEvent.upload(await screen.findByLabelText(/Logo/), big);

    expect(await screen.findByRole('alert')).toHaveTextContent('512 Ko');
    expect(writes(fetch)).toHaveLength(0);
  });

  it('shows the API refusal for an organization the user cannot see', async () => {
    logIn();
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
