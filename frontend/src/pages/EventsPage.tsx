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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Événements à venir</h1>
      {organizationId && (
        <p className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
            Organisation : {organization?.name ?? '...'}
          </span>
          <Link
            to="/"
            aria-label="Retirer le filtre par organisation"
            className="text-gray-600 underline"
          >
            ✕ Tous les événements
          </Link>
        </p>
      )}
      {error && <p className="text-red-600">Erreur : {error}</p>}
      {!error && !events && <p>Chargement...</p>}
      {events?.length === 0 && <p>Aucun événement à venir pour le moment.</p>}
      {events && events.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
