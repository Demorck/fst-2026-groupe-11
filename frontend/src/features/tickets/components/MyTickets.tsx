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

const dayOfMonth = (iso: string) => new Date(iso).getDate();
const monthShort = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short' });

/** "Aujourd'hui", "Demain" or "Dans N jours", from the calendar day and not from 24 h blocks. */
function countdown(iso: string, now: number) {
  const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfDay(Date.parse(iso)) - startOfDay(now)) / 86_400_000,
  );
  if (days <= 0) return "Aujourd'hui";
  return days === 1 ? 'Demain' : `Dans ${days} jours`;
}

function TicketsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only">Chargement...</p>
      <div className="skeleton h-32" />
      <div className="skeleton h-32" />
    </div>
  );
}

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
  if (!tickets) return <TicketsSkeleton />;
  if (tickets.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-3 p-8">
        <p className="text-lg font-semibold">
          Vous n'avez pas encore de billet.
        </p>
        <p className="text-muted">
          Réservez une place : le billet et son code apparaîtront ici.
        </p>
        <Link to="/" className="btn btn-primary">
          Voir les événements
        </Link>
      </div>
    );
  }

  const now = nowAtMount;
  const upcoming = tickets.filter((t) => Date.parse(t.event.endsAt) >= now);
  // API order is ascending: most recent past event first.
  const past = tickets
    .filter((t) => Date.parse(t.event.endsAt) < now)
    .reverse();

  return (
    <div className="space-y-10">
      <TicketSection title="À venir" tickets={upcoming} now={now} />
      <TicketSection title="Passés" tickets={past} now={now} />
    </div>
  );
}

function TicketSection({
  title,
  tickets,
  now,
}: {
  title: string;
  tickets: MyTicket[];
  now: number;
}) {
  if (tickets.length === 0) return null;
  const past = title === 'Passés';

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-sm text-muted">{tickets.length}</span>
      </div>
      <ul className="space-y-4">
        {tickets.map(({ id, code, checkedInAt, event }) => (
          <li
            key={id}
            className={`relative flex flex-col overflow-hidden rounded-xl border border-line bg-white sm:flex-row ${
              past ? 'opacity-75' : ''
            }`}
          >
            <div className="flex min-w-0 flex-1 gap-5 p-5 sm:p-6">
              <div
                aria-hidden="true"
                className="flex size-16 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-tint text-brand-deep"
              >
                <span className="font-display text-2xl leading-none font-bold">
                  {dayOfMonth(event.startsAt)}
                </span>
                <span className="text-xs font-semibold">
                  {monthShort(event.startsAt)}
                </span>
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap gap-2 empty:hidden">
                  {checkedInAt && (
                    <span className="badge badge-ok">Présence validée</span>
                  )}
                  {!past && !checkedInAt && (
                    <span className="badge badge-brand">
                      {countdown(event.startsAt, now)}
                    </span>
                  )}
                </div>
                <Link
                  to={`/events/${event.id}`}
                  className="block text-xl leading-snug font-semibold text-ink hover:text-brand hover:underline"
                >
                  {event.title}
                </Link>
                <p className="text-sm text-muted">
                  {formatDate(event.startsAt)}
                </p>
                <p className="text-sm text-muted">{event.location}</p>
              </div>
            </div>
            <div className="relative flex items-center justify-between gap-4 border-t-2 border-dashed border-line bg-canvas/60 p-5 sm:w-80 sm:border-t-0 sm:border-l-2 sm:p-6">
              {/* notches of the tear-off stub */}
              <span
                aria-hidden="true"
                className="absolute -top-2.5 -left-2.5 size-5 rounded-full border border-line bg-canvas"
              />
              <span
                aria-hidden="true"
                className="absolute -top-2.5 -right-2.5 size-5 rounded-full border border-line bg-canvas sm:top-auto sm:right-auto sm:-bottom-2.5 sm:-left-2.5"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] text-muted">Code du billet</p>
                <p>
                  <strong className="font-mono text-xl tracking-wide break-all">
                    {code}
                  </strong>
                </p>
              </div>
              <TicketQrCode code={code} className="size-24 shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
