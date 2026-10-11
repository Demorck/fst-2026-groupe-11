import { useDocumentTitle } from '../../../hooks/useDocumentTitle.ts';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../api/client.ts';
import { hasRole } from '../../auth/types.ts';
import { useAuth } from '../../auth/useAuth.ts';
import ProgressBar from '../../../components/ProgressBar.tsx';
import CategoryBanner from '../../events/components/CategoryBanner.tsx';
import {
  EVENT_CATEGORIES,
  formatEventDate,
  formatShortDay,
} from '../../events/types.ts';
import type { EventCategory } from '../../events/types.ts';
import { getMyOrganizations, getPublicOrganization } from '../api.ts';
import type { PublicOrganization } from '../types.ts';
import { useDataVersion } from '../../tickets/store.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

const isCategory = (value: string): value is EventCategory =>
  (EVENT_CATEGORIES as readonly string[]).includes(value);

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
  const version = useDataVersion();
  useDocumentTitle(organization?.name);
  const [member, setMember] = useState(false);

  useEffect(() => {
    let stale = false;
    getPublicOrganization(organizationId)
      .then((found) => {
        if (stale) return;
        setOrganization(found);
        setError(null);
      })
      .catch((err: Error) => !stale && setError(err));
    return () => {
      stale = true;
    };
  }, [organizationId, version]);

  // Only members get the link to the management page
  const canBeMember = hasRole(user?.role, 'VOLUNTEER');
  useEffect(() => {
    if (!canBeMember) return;
    let stale = false;
    getMyOrganizations()
      .then(
        (mine) =>
          !stale && setMember(mine.some(({ id }) => id === organizationId)),
      )
      .catch(() => !stale && setMember(false));
    return () => {
      stale = true;
    };
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
  if (!organization) return <p className="text-muted">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <OrganizationLogo
          organization={organization}
          className="size-24 text-3xl"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="page-title">{organization.name}</h1>
          {organization.description && (
            <p className="max-w-[70ch] text-muted">
              {organization.description}
            </p>
          )}
          <p className="text-sm text-muted">
            {organization.memberCount} membre(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/?organization=${organization.id}`}
            className="btn btn-secondary"
          >
            Voir tous ses événements
          </Link>
          {member && canBeMember && (
            <Link
              to={`/organizations/${organization.id}/manage`}
              className="btn btn-primary"
            >
              Gérer l'organisation
            </Link>
          )}
        </div>
      </div>

      <section aria-labelledby="upcoming" className="space-y-4">
        <h2 id="upcoming" className="text-xl font-semibold">
          Prochains événements
        </h2>
        {organization.upcomingEvents.length === 0 && (
          <p className="card text-muted">
            Aucun événement à venir pour le moment.
          </p>
        )}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5">
          {organization.upcomingEvents.map((event) => {
            const category = isCategory(event.category)
              ? event.category
              : 'OTHER';
            return (
              <li
                key={event.id}
                className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-white motion-safe:transition motion-safe:duration-150 hover:border-brand-edge hover:shadow-lg hover:shadow-ink/5 motion-safe:hover:-translate-y-0.5"
              >
                <CategoryBanner
                  category={category}
                  day={formatShortDay(event.startsAt)}
                />
                <div className="space-y-2 px-[18px] pt-4 pb-[18px]">
                  <Link
                    to={`/events/${event.id}`}
                    className="block text-[19px] leading-snug font-semibold text-ink after:absolute after:inset-0"
                  >
                    {event.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatEventDate(event.startsAt)} · {event.location}
                  </p>
                  <ProgressBar
                    value={event.capacity - event.remainingSeats}
                    max={event.capacity}
                    label={`Remplissage de ${event.title}`}
                  />
                  <p className="text-[13px] text-muted">
                    {event.remainingSeats > 0
                      ? `${event.remainingSeats} place(s) restante(s)`
                      : 'Complet'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
