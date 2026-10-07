import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TicketQrCode from './TicketQrCode.tsx';

describe('TicketQrCode', () => {
  it('draws a labelled QR code', () => {
    render(<TicketQrCode code="B2H9M3V3" />);

    const svg = screen.getByRole('img', { name: 'QR code du billet B2H9M3V3' });
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(
      /^M\d+ \d+h1v1h-1z/,
    );
  });

  it('draws a different code for a different ticket', () => {
    const draw = (code: string) =>
      render(<TicketQrCode code={code} />)
        .container.querySelector('path')
        ?.getAttribute('d');

    expect(draw('B2H9M3V3')).not.toBe(draw('K7P4Q8R2'));
  });
});
