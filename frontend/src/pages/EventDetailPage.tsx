import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useSession } from '../features/auth/session.ts';
import { getEvent } from '../features/events/api.ts';
import { CATEGORY_LABELS, formatEventDate } from '../features/events/types.ts';
import OrganizationLogo from '../features/organizations/components/OrganizationLogo.tsx';
import VolunteerBadge from '../features/organizations/components/VolunteerBadge.tsx';
import ReserveButton from '../features/tickets/components/ReserveButton.tsx';
import type { EventWithSeats } from '../features/events/types.ts';
import NotFoundPage from './NotFoundPage.tsx';

const actionClass =
  'rounded bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const role = useSession()?.user.role;
  const [event, setEvent] = useState<EventWithSeats | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getEvent(eventId)
      .then(setEvent)
      .catch((err: Error) => setError(err));
  }, [eventId]);

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />;
  }
  if (error) return <p className="text-red-600">Erreur : {error.message}</p>;
  if (!event) return <p>Chargement...</p>;

  return (
    <article className="space-y-4">
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt=""
          className="max-h-72 w-full rounded object-cover"
        />
      )}
      <h1 className="text-2xl font-semibold">{event.title}</h1>
      <VolunteerBadge status={event.volunteerStatus} />
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium">Début</dt>
        <dd>{formatEventDate(event.startsAt)}</dd>
        <dt className="font-medium">Fin</dt>
        <dd>{formatEventDate(event.endsAt)}</dd>
        <dt className="font-medium">Lieu</dt>
        <dd>{event.location}</dd>
        <dt className="font-medium">Catégorie</dt>
        <dd>{CATEGORY_LABELS[event.category]}</dd>
        <dt className="font-medium">Organisateur</dt>
        <dd>{event.organizer.name}</dd>
        <dt className="font-medium">Organisations</dt>
        <dd>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {event.organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  to={`/organizations/${organization.id}`}
                  className="flex items-center gap-2 text-indigo-700 hover:underline"
                >
                  <OrganizationLogo organization={organization} />
                  {organization.name}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
        {(role === 'VOLUNTEER' || role === 'ORGANIZER') &&
          event.volunteers.required > 0 && (
            <>
              <dt className="font-medium">Bénévoles</dt>
              <dd>
                {event.volunteers.registered} sur {event.volunteers.required}{' '}
                inscrits
                {event.volunteers.missing > 0 && (
                  <span className="ml-2 font-medium text-amber-700">
                    Il manque {event.volunteers.missing} bénévole(s)
                  </span>
                )}
              </dd>
            </>
          )}
        <dt className="font-medium">Places</dt>
        <dd>
          {event.remainingSeats} restante(s) sur {event.capacity}
        </dd>
      </dl>
      <p className="whitespace-pre-line">{event.description}</p>
      <section aria-label="Actions" className="flex flex-wrap gap-3">
        <ReserveButton eventId={event.id} />
        {(role === 'VOLUNTEER' || role === 'ORGANIZER') && (
          <Link to={`/events/${event.id}/shifts`} className={actionClass}>
            Créneaux bénévoles
          </Link>
        )}
        {role === 'ORGANIZER' && (
          <Link to={`/events/${event.id}/checkin`} className={actionClass}>
            Gérer le check-in
          </Link>
        )}
      </section>
    </article>
  );
}
