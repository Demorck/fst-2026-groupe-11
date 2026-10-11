import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckinList from './CheckinList.tsx';

const ticket = {
  id: 't1',
  code: 'B2H9M3V3',
  status: 'RESERVED',
  checkedInAt: null,
  participant: { id: 'p1', name: 'Alice', email: 'alice@test' },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const stubFetch = (...responses: Response[]) => {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('CheckinList', () => {
  it('lists the tickets with their presence status', async () => {
    stubFetch(
      json([
        ticket,
        {
          ...ticket,
          id: 't2',
          checkedInAt: '2026-10-10T18:00:00.000Z',
          participant: { ...ticket.participant, name: 'Bob' },
        },
        {
          ...ticket,
          id: 't3',
          status: 'CANCELLED',
          participant: { ...ticket.participant, name: 'Chloé' },
        },
      ]),
    );
    render(<CheckinList eventId="e1" />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
    expect(screen.getByText(/Présent depuis/)).toBeInTheDocument();
    expect(screen.getByText('Billet annulé')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Marquer présent' }),
    ).toHaveLength(1);
  });

  it('searches by name or code through the API', async () => {
    const fetch = stubFetch(json([ticket]), json([]));
    render(<CheckinList eventId="e1" />);
    await screen.findByText('Alice');

    fireEvent.change(screen.getByLabelText('Rechercher un inscrit'), {
      target: { value: 'B2H' },
    });

    expect(
      await screen.findByText('Aucun inscrit trouvé.'),
    ).toBeInTheDocument();
    expect(fetch.mock.calls[1][0]).toBe('/api/events/e1/tickets?search=B2H');
  });

  it('marks a participant present immediately', async () => {
    const fetch = stubFetch(
      json([ticket]),
      json({ ...ticket, checkedInAt: '2026-10-10T18:00:00.000Z' }),
    );
    render(<CheckinList eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Marquer présent' }),
    );

    expect(await screen.findByText(/Présent depuis/)).toBeInTheDocument();
    expect(fetch.mock.calls[1][0]).toBe('/api/tickets/t1/checkin');
    expect(fetch.mock.calls[1][1].method).toBe('POST');
  });

  it('says clearly when the participant is already present', async () => {
    stubFetch(
      json([ticket]),
      json({ message: 'Already checked in' }, 409),
      json([{ ...ticket, checkedInAt: '2026-10-10T18:00:00.000Z' }]),
    );
    render(<CheckinList eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Marquer présent' }),
    );

    expect(
      await screen.findByText('Alice est déjà marqué(e) présent(e).'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Présent depuis/)).toBeInTheDocument();
  });

  it('explains in French that a ticket was cancelled meanwhile', async () => {
    stubFetch(
      json([ticket]),
      json({ message: 'Ticket is cancelled' }, 400),
      json([{ ...ticket, status: 'CANCELLED' }]),
    );
    render(<CheckinList eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Marquer présent' }),
    );

    expect(
      await screen.findByText('Le billet de Alice est annulé.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ticket is cancelled')).not.toBeInTheDocument();
  });

  it('shows access denied to an organizer who does not manage the event', async () => {
    stubFetch(json({ message: 'Not a manager of this event' }, 403));
    render(<CheckinList eventId="e1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
  });
});
