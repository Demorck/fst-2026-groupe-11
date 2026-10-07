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
  const [nowAtMount] = useState(Date.now);

  useEffect(() => {
    getMyTickets()
      .then(setTickets)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p role="alert" className="alert-error">
        {error}
      </p>
    );
  }
  if (!tickets) return <p>Chargement...</p>;
  if (tickets.length === 0) {
    return (
      <p className="card text-muted">
        Vous n'avez pas encore de billet.{' '}
        <Link to="/" className="font-semibold underline">
          Voir les événements
        </Link>
      </p>
    );
  }

  const now = nowAtMount;
  const upcoming = tickets.filter((t) => Date.parse(t.event.endsAt) >= now);
  // API order is ascending: most recent past event first.
  const past = tickets
    .filter((t) => Date.parse(t.event.endsAt) < now)
    .reverse();

  return (
    <div className="space-y-8">
      <TicketSection title="À venir" tickets={upcoming} />
      <TicketSection title="Passés" tickets={past} />
    </div>
  );
}

function TicketSection({
  title,
  tickets,
}: {
  title: string;
  tickets: MyTicket[];
}) {
  if (tickets.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="space-y-4">
        {tickets.map(({ id, code, checkedInAt, event }) => (
          <li
            key={id}
            className="flex flex-wrap rounded-xl border border-line bg-white"
          >
            <div className="flex min-w-0 flex-[999_1_320px] flex-col gap-1.5 px-6 py-5">
              {checkedInAt && (
                <span className="badge badge-ok self-start">
                  Présence validée
                </span>
              )}
              <Link
                to={`/events/${event.id}`}
                className="text-xl font-semibold text-ink hover:text-brand hover:underline"
              >
                {event.title}
              </Link>
              <p className="text-sm text-muted">{formatDate(event.startsAt)}</p>
              <p className="text-sm text-muted">{event.location}</p>
            </div>
            <div className="flex flex-[1_1_240px] items-center justify-between gap-4 border-t-2 border-dashed border-line px-6 py-5 sm:border-t-0 sm:border-l-2">
              <div className="space-y-1">
                <p className="text-[13px] text-muted">Code du billet</p>
                <p>
                  <strong className="font-mono text-xl tracking-wide">
                    {code}
                  </strong>
                </p>
              </div>
              <TicketQrCode code={code} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
