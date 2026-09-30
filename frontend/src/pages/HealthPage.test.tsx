import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HealthPage from './HealthPage.tsx';

describe('HealthPage', () => {
  it('shows the API health payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ok',
            databaseTime: '2026-09-30T10:00:00.000Z',
            users: 3,
          }),
        ),
      ),
    );

    render(<HealthPage />);

    expect(await screen.findByText(/"users": 3/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('shows an error when the API is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );

    render(<HealthPage />);

    expect(
      await screen.findByText('Erreur : API 502 on /health'),
    ).toBeInTheDocument();
  });
});
