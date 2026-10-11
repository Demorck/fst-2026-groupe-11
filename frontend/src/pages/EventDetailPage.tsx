import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useSession } from '../features/auth/session.ts';
import { hasRole } from '../features/auth/types.ts';
import { getEvent } from '../features/events/api.ts';
import ProgressBar from '../components/ProgressBar.tsx';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  formatEventDate,
} from '../features/events/types.ts';
import OrganizationLogo from '../features/organizations/components/OrganizationLogo.tsx';
import VolunteerBadge from '../features/organizations/components/VolunteerBadge.tsx';
import { useDataVersion, useHeldTicket } from '../features/tickets/store.ts';
import ReserveButton from '../features/tickets/components/ReserveButton.tsx';
import type { EventWithAccess } from '../features/events/types.ts';
import NotFoundPage from './NotFoundPage.tsx';

export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const role = useSession()?.user.role;
  const { held, loading: ticketsLoading } = useHeldTicket(eventId);
  const [event, setEvent] = useState<EventWithAccess | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Seats move when a ticket is booked or cancelled: read the event again
  const version = useDataVersion();
  useDocumentTitle(event?.title);

  useEffect(() => {
    // An older answer must not overwrite a newer one (quick booking then cancelling, or another event)
    let stale = false;
    getEvent(eventId)
      .then((found) => {
        if (stale) return;
        setEvent(found);
        setError(null);
      })
      .catch((err: Error) => !stale && setError(err));
    return () => {
      stale = true;
    };
  }, [eventId, version]);

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />;
  }
  if (error) {
    return <p className="alert-error">Erreur : {error.message}</p>;
  }
  // Another event is being read: do not show the previous one meanwhile
  if (!event || event.id !== eventId) {
    return <p className="text-muted">Chargement...</p>;
  }

  const { tint, ink } = CATEGORY_STYLES[event.category];
  const volunteerView = hasRole(role, 'VOLUNTEER');
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const time = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = start.toDateString() === end.toDateString();

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
        className="flex min-h-40 flex-col justify-between gap-5 rounded-2xl p-6 sm:p-7"
        style={{ backgroundColor: tint, color: ink }}
      >
        <span className="badge self-start bg-white" style={{ color: ink }}>
          {CATEGORY_LABELS[event.category]}
        </span>
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-[44px]">
          {event.title}
        </h1>
      </div>

      <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        <Fact label="Date">
          {start.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Fact>
        <Fact label="Horaires">
          {time(start)} – {sameDay ? time(end) : formatEventDate(event.endsAt)}
        </Fact>
        <Fact label="Lieu">{event.location}</Fact>
        <Fact label="Organisateur">{event.organizer.name}</Fact>
      </dl>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <h2 className="text-[22px] font-semibold">À propos</h2>
            <p className="max-w-[70ch] whitespace-pre-line text-ink/90">
              {event.description}
            </p>
          </section>

          <section aria-labelledby="orgs" className="space-y-3">
            <h2 id="orgs" className="text-[22px] font-semibold">
              Organisé par
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {event.organizations.map((organization) => (
                <li
                  key={organization.id}
                  className="card relative flex items-center gap-3 p-4 motion-safe:transition hover:border-brand-edge"
                >
                  <OrganizationLogo
                    organization={organization}
                    className="size-12 text-base"
                  />
                  <div className="min-w-0">
                    <Link
                      to={`/organizations/${organization.id}`}
                      className="font-semibold text-ink after:absolute after:inset-0"
                    >
                      {organization.name}
                    </Link>
                    {organization.description && (
                      <p className="line-clamp-2 text-sm text-muted">
                        {organization.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {volunteerView && event.volunteers.required > 0 && (
            <section className="card space-y-3 p-5">
              <h2 className="text-lg font-semibold">Bénévoles</h2>
              <ProgressBar
                value={event.volunteers.registered}
                max={event.volunteers.required}
                label="Couverture bénévole"
                className={event.volunteers.missing > 0 ? 'progress-warn' : ''}
              />
              <p>
                {event.volunteers.registered} sur {event.volunteers.required}{' '}
                inscrits
              </p>
              {event.volunteers.missing > 0 && (
                <p className="font-medium text-warn-ink">
                  Il manque {event.volunteers.missing} bénévole(s)
                </p>
              )}
            </section>
          )}
        </div>

        <aside
          aria-label="Réservation"
          className="card flex flex-col gap-4 p-6 max-lg:order-first lg:sticky lg:top-24"
        >
          <VolunteerBadge status={event.volunteerStatus} />
          {event.remainingSeats <= 0 && !held && !ticketsLoading && (
            <span className="badge badge-danger self-start">
              Aucun billet n'est disponible
            </span>
          )}
          <p className="font-display text-2xl font-bold">
            {event.remainingSeats} restante(s) sur {event.capacity}
          </p>
          <ProgressBar
            value={event.capacity - event.remainingSeats}
            max={event.capacity}
            label="Remplissage"
            className="h-2"
          />
          <ReserveButton eventId={event.id} startsAt={event.startsAt} />
          {volunteerView && (
            <Link
              to={`/events/${event.id}/shifts`}
              className="btn btn-secondary"
            >
              Créneaux bénévoles
            </Link>
          )}
          {event.canManage && (
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold first-letter:uppercase">{children}</dd>
    </div>
  );
}
