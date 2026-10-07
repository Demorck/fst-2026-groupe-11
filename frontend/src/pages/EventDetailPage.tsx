import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useSession } from '../features/auth/session.ts';
import { getEvent } from '../features/events/api.ts';
import ProgressBar from '../components/ProgressBar.tsx';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  formatEventDate,
} from '../features/events/types.ts';
import OrganizationLogo from '../features/organizations/components/OrganizationLogo.tsx';
import VolunteerBadge from '../features/organizations/components/VolunteerBadge.tsx';
import ReserveButton from '../features/tickets/components/ReserveButton.tsx';
import type { EventWithSeats } from '../features/events/types.ts';
import NotFoundPage from './NotFoundPage.tsx';

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
  if (error) {
    return <p className="alert-error">Erreur : {error.message}</p>;
  }
  if (!event) return <p className="text-muted">Chargement...</p>;

  const { tint, ink } = CATEGORY_STYLES[event.category];
  const volunteerView = role === 'VOLUNTEER' || role === 'ORGANIZER';

  return (
    <article className="space-y-6">
      <Link to="/" className="inline-flex min-h-11 items-center text-sm">
        ← Tous les événements
      </Link>
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt=""
          className="max-h-72 w-full rounded-2xl object-cover"
        />
      )}
      <div
        className="flex min-h-52 flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7"
        style={{ backgroundColor: tint, color: ink }}
      >
        <span className="badge self-start bg-white" style={{ color: ink }}>
          {CATEGORY_LABELS[event.category]}
        </span>
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-[44px]">
          {event.title}
        </h1>
      </div>
      <VolunteerBadge status={event.volunteerStatus} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <dl className="card grid gap-x-4 gap-y-3 sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted">Début</dt>
            <dd className="font-semibold">{formatEventDate(event.startsAt)}</dd>
            <dt className="text-muted">Fin</dt>
            <dd className="font-semibold">{formatEventDate(event.endsAt)}</dd>
            <dt className="text-muted">Lieu</dt>
            <dd className="font-semibold">{event.location}</dd>
            <dt className="text-muted">Organisateur</dt>
            <dd className="font-semibold">{event.organizer.name}</dd>
            <dt className="text-muted">Organisations</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {event.organizations.map((organization) => (
                  <li key={organization.id}>
                    <Link
                      to={`/organizations/${organization.id}`}
                      className="flex items-center gap-2 font-semibold"
                    >
                      <OrganizationLogo organization={organization} />
                      {organization.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
            {volunteerView && event.volunteers.required > 0 && (
              <>
                <dt className="text-muted">Bénévoles</dt>
                <dd>
                  {event.volunteers.registered} sur {event.volunteers.required}{' '}
                  inscrits
                  {event.volunteers.missing > 0 && (
                    <span className="ml-2 font-medium text-warn-ink">
                      Il manque {event.volunteers.missing} bénévole(s)
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
          <div className="space-y-3">
            <h2 className="text-[22px] font-semibold">À propos</h2>
            <p className="whitespace-pre-line text-ink/90">
              {event.description}
            </p>
          </div>
        </div>

        <aside
          aria-label="Réservation"
          className="card flex flex-[1_1_300px] flex-col gap-4 p-6"
        >
          <p className="font-display text-2xl font-bold">
            {event.remainingSeats} restante(s) sur {event.capacity}
          </p>
          <ProgressBar
            value={event.capacity - event.remainingSeats}
            max={event.capacity}
            label="Remplissage"
            className="h-2"
          />
          <ReserveButton eventId={event.id} />
          {volunteerView && (
            <Link
              to={`/events/${event.id}/shifts`}
              className="btn btn-secondary"
            >
              Créneaux bénévoles
            </Link>
          )}
          {role === 'ORGANIZER' && (
            <Link
              to={`/events/${event.id}/checkin`}
              className="btn btn-secondary"
            >
              Gérer le check-in
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
}
