import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getMyTickets } from '../api.ts';
import type { MyTicket } from '../types.ts';
import TicketQrCode from './TicketQrCode.tsx';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

export default function MyTickets() {
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyTickets()
      .then(setTickets)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  if (!tickets) return <p>Chargement...</p>;
  if (tickets.length === 0) {
    return (
      <p>
        Vous n'avez pas encore de billet.{' '}
        <Link to="/" className="underline">
          Voir les événements
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {tickets.map(({ id, code, checkedInAt, event }) => (
        <li
          key={id}
          className="flex flex-wrap items-center justify-between gap-4 rounded bg-white p-4 shadow"
        >
          <div className="space-y-1">
            <Link
              to={`/events/${event.id}`}
              className="text-lg font-semibold underline"
            >
              {event.title}
            </Link>
            <p>{formatDate(event.startsAt)}</p>
            <p>{event.location}</p>
            <p>
              Code : <strong className="font-mono">{code}</strong>
            </p>
            {checkedInAt && <p className="text-green-700">Présence validée</p>}
          </div>
          <TicketQrCode code={code} />
        </li>
      ))}
    </ul>
  );
}
