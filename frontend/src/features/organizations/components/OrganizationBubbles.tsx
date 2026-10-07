import { Link } from 'react-router';
import type { OrganizationSummary } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

/** Row of small bubbles, one per organization running an event (name on hover and for screen readers). */
export default function OrganizationBubbles({
  organizations,
}: {
  organizations: OrganizationSummary[];
}) {
  if (organizations.length === 0) return null;
  return (
    <ul aria-label="Organisations" className="flex -space-x-2">
      {organizations.map((organization) => (
        <li key={organization.id} title={organization.name}>
          <Link
            to={`/organizations/${organization.id}`}
            className="inline-block rounded-full"
          >
            <OrganizationLogo organization={organization} />
            <span className="sr-only">{organization.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
