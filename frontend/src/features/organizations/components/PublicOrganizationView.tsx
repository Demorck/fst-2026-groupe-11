import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../api/client.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { formatEventDate } from '../../events/types.ts';
import { getMyOrganizations, getPublicOrganization } from '../api.ts';
import type { PublicOrganization } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

/** What anyone can see of an organization: who they are and what they run next. */
export default function PublicOrganizationView({
  organizationId,
}: {
  organizationId: string;
}) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<PublicOrganization | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [member, setMember] = useState(false);

  useEffect(() => {
    getPublicOrganization(organizationId)
      .then(setOrganization)
      .catch((err: Error) => setError(err));
  }, [organizationId]);

  // Only members get the link to the management page
  const canBeMember = user?.role === 'ORGANIZER' || user?.role === 'VOLUNTEER';
  useEffect(() => {
    if (!canBeMember) return;
    getMyOrganizations()
      .then((mine) => setMember(mine.some(({ id }) => id === organizationId)))
      .catch(() => setMember(false));
  }, [canBeMember, organizationId]);

  if (error instanceof ApiError && error.status === 404) {
    return <p role="alert">Organisation introuvable.</p>;
  }
  if (error) {
    return (
      <p role="alert" className="alert-error">
        Erreur : {error.message}
      </p>
    );
  }
  if (!organization) return <p>Chargement...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-5">
        <OrganizationLogo
          organization={organization}
          className="size-24 text-3xl"
        />
        <div className="space-y-1">
          <h1 className="page-title">{organization.name}</h1>
          {organization.description && (
            <p className="text-muted">{organization.description}</p>
          )}
          <p className="text-sm text-muted">
            {organization.memberCount} membre(s)
          </p>
          {member && (
            <Link
              to={`/organizations/${organization.id}/manage`}
              className="text-sm underline"
            >
              Gérer l'organisation
            </Link>
          )}
        </div>
      </div>

      <section aria-labelledby="upcoming" className="space-y-3">
        <h2 id="upcoming" className="text-xl font-semibold">
          Prochains événements
        </h2>
        {organization.upcomingEvents.length === 0 && (
          <p>Aucun événement à venir pour le moment.</p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {organization.upcomingEvents.map((event) => (
            <li key={event.id} className="card p-4">
              <Link
                to={`/events/${event.id}`}
                className="font-semibold hover:underline"
              >
                {event.title}
              </Link>
              <p className="text-sm text-muted">
                {formatEventDate(event.startsAt)} · {event.location}
              </p>
              <p className="text-sm">
                {event.remainingSeats > 0
                  ? `${event.remainingSeats} place(s) restante(s)`
                  : 'Complet'}
              </p>
            </li>
          ))}
        </ul>
        <Link
          to={`/?organization=${organization.id}`}
          className="inline-block underline"
        >
          Voir tous ses événements
        </Link>
      </section>
    </div>
  );
}
