import { useEffect, useState } from 'react';
import { listUpcomingEvents } from '../features/events/api.ts';
import EventCard from '../features/events/components/EventCard.tsx';
import type { EventWithSeats } from '../features/events/types.ts';

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithSeats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUpcomingEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Événements à venir</h1>
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
