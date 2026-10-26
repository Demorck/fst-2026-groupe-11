import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AttendancePrediction from './AttendancePrediction.tsx';

const prediction = {
  estimate: 62,
  fillRate: 0.62,
  confidence: 'MEDIUM',
  sampleSize: 3,
  warning: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const stubFetch = (...responses: Response[]) => {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const renderPrediction = (props = {}) =>
  render(
    <AttendancePrediction
      category="PARTY"
      startsAt="2026-12-01T19:00"
      capacity="100"
      {...props}
    />,
  );

describe('AttendancePrediction', () => {
  it('shows the estimate and its confidence for the inputs of the form', async () => {
    const fetch = stubFetch(json(prediction));
    renderPrediction();

    expect(await screen.findByText(/environ 62 billets/)).toBeInTheDocument();
    expect(screen.getByText('sur 100 (62 %)')).toBeInTheDocument();
    expect(screen.getByText('Confiance moyenne')).toBeInTheDocument();
    expect(screen.getByText(/3 événements passés/)).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/ai/attendance-prediction');
    expect(JSON.parse(init.body)).toEqual({
      category: 'PARTY',
      startsAt: new Date('2026-12-01T19:00').toISOString(),
      capacity: 100,
    });
  });

  it('shows the advice of the API about the capacity', async () => {
    stubFetch(
      json({
        ...prediction,
        confidence: 'HIGH',
        warning: {
          type: 'OVERBOOKING_RISK',
          message: "envisagez d'augmenter la capacité.",
        },
      }),
    );
    renderPrediction();

    expect(await screen.findByRole('status')).toHaveTextContent(
      "envisagez d'augmenter la capacité.",
    );
    expect(screen.getByText('Confiance élevée')).toBeInTheDocument();
  });

  it('asks nothing until the date and the capacity are filled', () => {
    const fetch = stubFetch();
    renderPrediction({ startsAt: '', capacity: '' });

    expect(screen.getByText(/Renseignez la date de début/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says so when there is no history yet', async () => {
    stubFetch(
      json({ ...prediction, estimate: null, fillRate: null, sampleSize: 0 }),
    );
    renderPrediction();

    expect(
      await screen.findByText(/Pas encore d'événement passé/),
    ).toBeInTheDocument();
  });

  it('shows a loading state, then an error that can be retried', async () => {
    stubFetch(json({ message: 'Boom' }, 500), json(prediction));
    renderPrediction();

    expect(screen.getByText('Estimation en cours...')).toBeInTheDocument();
    expect(
      await screen.findByText(/Estimation indisponible : Boom/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText(/environ 62 billets/)).toBeInTheDocument();
  });

  it('forgets the previous estimate when an input changes', async () => {
    stubFetch(json(prediction), json({ ...prediction, estimate: 30 }));
    const { rerender } = renderPrediction();
    await screen.findByText(/environ 62 billets/);

    rerender(
      <AttendancePrediction
        category="PARTY"
        startsAt="2026-12-01T19:00"
        capacity="50"
      />,
    );

    expect(screen.queryByText(/environ 62 billets/)).toBeNull();
    expect(await screen.findByText(/environ 30 billets/)).toBeInTheDocument();
  });
});
