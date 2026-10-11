import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '../../auth/types.ts';
import DialogHost from '../../../components/DialogHost.tsx';
import OrganizationsOverview from './OrganizationsOverview.tsx';

function logInAs(role: Role) {
  const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', role };
  localStorage.setItem('session', JSON.stringify({ accessToken: 't', user }));
}

const bde = {
  id: 'o1',
  name: 'BDE Nancy',
  description: null,
  hasLogo: false,
  updatedAt: '2026-10-07T10:00:00.000Z',
};
const invitation = {
  id: 'i1',
  role: 'VOLUNTEER',
  createdAt: '',
  organization: bde,
};

/** Routes the API calls of the page; `invitations` can change after an answer. */
function stubApi({
  mine = [] as object[],
  invitations = [] as object[],
  post = () => new Response('{}'),
} = {}) {
  let pending = invitations;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (url.includes('/invitations/')) pending = [];
      return Promise.resolve(post());
    }
    return Promise.resolve(
      new Response(JSON.stringify(url.endsWith('/mine') ? mine : pending)),
    );
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderOverview = () =>
  render(
    <MemoryRouter>
      <OrganizationsOverview />
      <DialogHost />
    </MemoryRouter>,
  );

describe('OrganizationsOverview', () => {
  it('lists my organizations with my role and a link to each', async () => {
    logInAs('VOLUNTEER');
    stubApi({ mine: [{ ...bde, role: 'VOLUNTEER' }] });
    renderOverview();

    expect(
      await screen.findByRole('link', { name: 'BDE Nancy' }),
    ).toHaveAttribute('href', '/organizations/o1/manage');
    expect(screen.getByText('Bénévole')).toBeInTheDocument();
  });

  it('says so when I belong to no organization', async () => {
    logInAs('VOLUNTEER');
    stubApi();
    renderOverview();

    expect(
      await screen.findByText(/n'appartenez à aucune organisation/),
    ).toBeInTheDocument();
  });

  it('shows the creation form to organizers only', async () => {
    logInAs('VOLUNTEER');
    stubApi();
    const { unmount } = renderOverview();
    await screen.findByText(/aucune organisation/);
    expect(
      screen.queryByRole('heading', { name: 'Créer une organisation' }),
    ).toBeNull();
    unmount();

    localStorage.clear();
    logInAs('ORGANIZER');
    renderOverview();

    expect(
      await screen.findByRole('heading', { name: 'Créer une organisation' }),
    ).toBeInTheDocument();
  });

  it('accepts an invitation and reloads the lists', async () => {
    logInAs('VOLUNTEER');
    const fetch = stubApi({ invitations: [invitation] });
    renderOverview();

    await userEvent.click(
      await screen.findByRole('button', {
        name: "Accepter l'invitation de BDE Nancy",
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/organizations/invitations/i1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
    // The invitation is gone once the lists are reloaded
    await vi.waitFor(() =>
      expect(screen.queryByText(/vous invite/)).toBeNull(),
    );
  });

  it('declines an invitation', async () => {
    logInAs('VOLUNTEER');
    const fetch = stubApi({ invitations: [invitation] });
    renderOverview();

    await userEvent.click(
      await screen.findByRole('button', {
        name: "Refuser l'invitation de BDE Nancy",
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/organizations/invitations/i1/decline',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('translates an API refusal when creating an organization', async () => {
    logInAs('ORGANIZER');
    stubApi({
      post: () =>
        new Response(
          JSON.stringify({ message: 'Organization name already used' }),
          {
            status: 409,
          },
        ),
    });
    renderOverview();

    await userEvent.type(await screen.findByLabelText('Nom'), 'BDE Nancy');
    await userEvent.click(
      screen.getByRole('button', { name: "Créer l'organisation" }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce nom d’organisation est déjà utilisé.',
    );
  });

  it('sends the chosen logo once the organization is created', async () => {
    logInAs('ORGANIZER');
    const fetch = stubApi({
      post: () => new Response(JSON.stringify({ ...bde, id: 'o9' })),
    });
    renderOverview();
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });

    await userEvent.type(await screen.findByLabelText('Nom'), 'BDE Nancy');
    await userEvent.upload(screen.getByLabelText(/Logo/), logo);
    expect(screen.getByText('logo.png')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: "Créer l'organisation" }),
    );

    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/organizations/o9/logo',
        expect.objectContaining({ method: 'PUT', body: logo }),
      ),
    );
    const methods = fetch.mock.calls
      .filter(([, init]) => init?.method)
      .map(([url, init]) => `${init?.method} ${url}`);
    expect(methods).toEqual([
      'POST /api/organizations',
      'PUT /api/organizations/o9/logo',
    ]);
  });

  it('lets a volunteer leave an organization from the list', async () => {
    logInAs('VOLUNTEER');
    const fetch = stubApi({ mine: [{ ...bde, role: 'VOLUNTEER' }] });
    renderOverview();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Quitter BDE Nancy' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === '/api/organizations/o1/leave' && init?.method === 'POST',
        ),
      ).toBe(true),
    );
  });

  it('translates the refusal when the creator cannot leave yet', async () => {
    logInAs('ORGANIZER');
    stubApi({
      mine: [{ ...bde, role: 'MANAGER' }],
      post: () =>
        new Response(
          JSON.stringify({
            message: 'The creator cannot leave while co-managers remain',
          }),
          { status: 409 },
        ),
    });
    renderOverview();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Quitter BDE Nancy' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      /co-gestionnaires/,
    );
  });
});
