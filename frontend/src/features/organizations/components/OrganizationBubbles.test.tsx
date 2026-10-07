import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

const renderBubbles = (organizations: OrganizationSummary[], max?: number) =>
  render(
    <MemoryRouter>
      <OrganizationBubbles organizations={organizations} max={max} />
    </MemoryRouter>,
  );

describe('OrganizationBubbles', () => {
  it('links each bubble to the public page of the organization', () => {
    renderBubbles([org('o1', 'BDE Nancy', false)]);

    expect(screen.getByRole('link', { name: 'BDE Nancy' })).toHaveAttribute(
      'href',
      '/organizations/o1',
    );
  });

  it('shows one bubble per organization, named for hover and screen readers', () => {
    renderBubbles([
      org('o1', 'BDE Nancy', true),
      org('o2', 'Club Sport', false),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('title', 'BDE Nancy');
    expect(screen.getByText('Club Sport')).toHaveClass('sr-only');
  });

  it('shows the logo when there is one and the initials otherwise', () => {
    const { container } = renderBubbles([
      org('o1', 'BDE Nancy', true),
      org('o2', 'Club Sport', false),
    ]);

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/organizations/o1/logo?v=2026-10-07T10%3A00%3A00.000Z',
    );
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('shows at most max bubbles and counts the others', () => {
    renderBubbles(
      ['A', 'B', 'C', 'D', 'E'].map((name) => org(`o${name}`, name, false)),
      3,
    );

    expect(screen.getAllByRole('link')).toHaveLength(3);
    const more = screen.getByText('+2 organisations');
    expect(more).toHaveAttribute('title', 'D, E');
  });

  it('uses the singular for a single hidden organization', () => {
    renderBubbles(
      ['A', 'B', 'C', 'D'].map((name) => org(`o${name}`, name, false)),
      3,
    );

    expect(screen.getByText('+1 organisation')).toBeInTheDocument();
  });

  it('renders nothing without organization', () => {
    const { container } = renderBubbles([]);

    expect(container).toBeEmptyDOMElement();
  });
});
