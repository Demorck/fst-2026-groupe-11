import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VolunteerBadge from './VolunteerBadge.tsx';

describe('VolunteerBadge', () => {
  it('is green when the volunteer already works on the event', () => {
    render(<VolunteerBadge status="ASSIGNED" />);

    expect(
      screen.getByText('Vous êtes bénévole sur cet événement'),
    ).toHaveClass('bg-green-100');
  });

  it('is grey when the volunteer could join', () => {
    render(<VolunteerBadge status="AVAILABLE" />);

    expect(
      screen.getByText('Vous pouvez bénévoler à cet événement'),
    ).toHaveClass('bg-gray-100');
  });

  it.each([undefined, null])('renders nothing for %s', (status) => {
    const { container } = render(<VolunteerBadge status={status} />);

    expect(container).toBeEmptyDOMElement();
  });
});
