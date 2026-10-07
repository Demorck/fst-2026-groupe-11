import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listUpcomingEvents } from '../features/events/api.ts';
import EventCard from '../features/events/components/EventCard.tsx';
import type { EventWithSeats } from '../features/events/types.ts';

export default function EventsPage() {
  // ?organization=<id>: the events of one organization (link from its public page)
  const organizationId = useSearchParams()[0].get('organization') ?? undefined;

  // key: another filter starts from a fresh state instead of resetting it in an effect
  return (
    <EventsList key={organizationId ?? 'all'} organizationId={organizationId} />
  );
}

function EventsList({ organizationId }: { organizationId?: string }) {
  const [events, setEvents] = useState<EventWithSeats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUpcomingEvents(organizationId)
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, [organizationId]);

  const organization = events
    ?.flatMap((event) => event.organizations)
    .find(({ id }) => id === organizationId);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Événements à venir</h1>
          <p className="page-subtitle">
            Réservez votre place aux événements des associations du campus.
          </p>
        </div>
        {events && (
          <span className="text-sm text-muted">
            {events.length} événement(s)
          </span>
        )}
      </div>
      {organizationId && (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="badge badge-brand px-3 py-1 text-sm">
            Organisation : {organization?.name ?? '...'}
          </span>
          <Link
            to="/"
            aria-label="Retirer le filtre par organisation"
            className="inline-flex min-h-11 items-center text-muted underline"
          >
            ✕ Tous les événements
          </Link>
        </p>
      )}
      {error && <p className="alert-error">Erreur : {error}</p>}
      {!error && !events && <p className="text-muted">Chargement...</p>}
      {events?.length === 0 && (
        <p className="card text-muted">
          Aucun événement à venir pour le moment.
        </p>
      )}
      {events && events.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
