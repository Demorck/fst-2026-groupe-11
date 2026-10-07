import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AttestationView from './AttestationView.tsx';

const attestation = {
  organization: {
    id: 'o1',
    name: 'BDE Nancy',
    description: null,
    hasLogo: false,
    updatedAt: '2026-10-07T10:00:00.000Z',
  },
  volunteer: { id: 'u2', name: 'Bastien Bénévole' },
  issuedAt: '2026-10-07T10:00:00.000Z',
  totalHours: 3.5,
  shifts: [
    {
      eventId: 'e1',
      eventTitle: 'Gala',
      shiftTitle: 'Accueil',
      startsAt: '2026-06-01T09:00:00.000Z',
      endsAt: '2026-06-01T11:00:00.000Z',
      hours: 2,
    },
    {
      eventId: 'e1',
      eventTitle: 'Gala',
      shiftTitle: 'Rangement',
      startsAt: '2026-06-01T22:00:00.000Z',
      endsAt: '2026-06-01T23:30:00.000Z',
      hours: 1.5,
    },
  ],
};

describe('AttestationView', () => {
  it('states the organization, the volunteer and the total, with each shift', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(attestation)));
    vi.stubGlobal('fetch', fetch);
    render(<AttestationView organizationId="o1" userId="u2" />);

    expect(
      await screen.findByRole('heading', { name: 'Attestation de bénévolat' }),
    ).toBeInTheDocument();
    expect(screen.getByText('BDE Nancy')).toBeInTheDocument();
    expect(screen.getByText('Bastien Bénévole')).toBeInTheDocument();
    expect(screen.getByText('3.5 heure(s)')).toBeInTheDocument();
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('1.5 h')).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/organizations/o1/members/u2/attestation',
    );
  });

  it('prints on click, and the button is hidden once printed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(attestation))),
    );
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<AttestationView organizationId="o1" userId="u2" />);

    const button = await screen.findByRole('button', { name: 'Imprimer' });
    await userEvent.click(button);

    expect(print).toHaveBeenCalled();
    expect(button).toHaveClass('print:hidden');
  });

  it('shows the API refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Not a manager of this organization' }),
          {
            status: 403,
          },
        ),
      ),
    );
    render(<AttestationView organizationId="o1" userId="u2" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Seuls les gestionnaires',
    );
  });
});
