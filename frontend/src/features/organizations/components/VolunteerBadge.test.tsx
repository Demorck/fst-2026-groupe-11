import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VolunteerBadge from './VolunteerBadge.tsx';

describe('VolunteerBadge', () => {
  it('is green when the volunteer already works on the event', () => {
    render(<VolunteerBadge status="ASSIGNED" />);

    expect(
      screen.getByText('Vous êtes bénévole sur cet événement'),
    ).toHaveClass('badge-ok');
  });

  it('is grey when the volunteer could join', () => {
    render(<VolunteerBadge status="AVAILABLE" />);

    expect(
      screen.getByText('Vous pouvez bénévoler à cet événement'),
    ).not.toHaveClass('badge-ok');
  });

  it.each([undefined, null])('renders nothing for %s', (status) => {
    const { container } = render(<VolunteerBadge status={status} />);

    expect(container).toBeEmptyDOMElement();
  });
});
