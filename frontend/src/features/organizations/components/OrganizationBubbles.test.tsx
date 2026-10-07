import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrganizationSummary } from '../types.ts';
import OrganizationBubbles from './OrganizationBubbles.tsx';

const org = (
  id: string,
  name: string,
  hasLogo: boolean,
): OrganizationSummary => ({
  id,
  name,
  description: null,
  hasLogo,
  updatedAt: '2026-10-07T10:00:00.000Z',
});

describe('OrganizationBubbles', () => {
  it('shows one bubble per organization, named for hover and screen readers', () => {
    render(
      <OrganizationBubbles
        organizations={[
          org('o1', 'BDE Nancy', true),
          org('o2', 'Club Sport', false),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('title', 'BDE Nancy');
    expect(screen.getByText('Club Sport')).toHaveClass('sr-only');
  });

  it('shows the logo when there is one and the initials otherwise', () => {
    const { container } = render(
      <OrganizationBubbles
        organizations={[
          org('o1', 'BDE Nancy', true),
          org('o2', 'Club Sport', false),
        ]}
      />,
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/organizations/o1/logo?v=2026-10-07T10%3A00%3A00.000Z',
    );
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('renders nothing without organization', () => {
    const { container } = render(<OrganizationBubbles organizations={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
