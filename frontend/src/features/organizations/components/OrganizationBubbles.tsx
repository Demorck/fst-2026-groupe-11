import { Link } from 'react-router';
import type { OrganizationSummary } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

/** Row of small bubbles, one per organization running an event (name on hover and for screen readers). */
export default function OrganizationBubbles({
  organizations,
  max = organizations.length,
}: {
  organizations: OrganizationSummary[];
  /** Bubbles shown before a "+N organisation(s)" pill takes over for the others. */
  max?: number;
}) {
  if (organizations.length === 0) return null;
  const hidden = organizations.slice(max);
  return (
    <ul aria-label="Organisations" className="flex -space-x-2">
      {organizations.slice(0, max).map((organization) => (
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
      {hidden.length > 0 && (
        <li
          title={hidden.map(({ name }) => name).join(', ')}
          className="ml-3 flex items-center text-sm text-muted"
        >
          +{hidden.length} organisation{hidden.length > 1 ? 's' : ''}
        </li>
      )}
    </ul>
  );
}
