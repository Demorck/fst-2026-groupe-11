import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import ConfirmButton from '../../../components/ConfirmButton.tsx';
import { alertDialog, toast } from '../../../components/dialogs.ts';
import { formatEventDate, proximity } from '../../events/types.ts';
import { cancelTicket, useMyTickets } from '../store.ts';
import { TICKET_ERRORS } from '../messages.ts';
import type { MyTicket } from '../types.ts';
import TicketQrCode from './TicketQrCode.tsx';

const dayOfMonth = (iso: string) => new Date(iso).getDate();
const monthShort = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short' });

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
  const { tickets, error } = useMyTickets();
  const [nowAtMount] = useState(Date.now);

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
  const [next, ...later] = upcoming;

  return (
    <div className="space-y-10">
      {next && (
        <TicketSection title="Prochain billet">
          <TicketCard ticket={next} now={now} size="large" />
        </TicketSection>
      )}
      {later.length > 0 && (
        <TicketSection title="À venir" count={later.length} grid>
          {later.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} now={now} />
          ))}
        </TicketSection>
      )}
      {past.length > 0 && (
        <TicketSection title="Passés" count={past.length} grid>
          {past.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} now={now} past />
          ))}
        </TicketSection>
      )}
    </div>
  );
}

function TicketSection({
  title,
  count,
  grid,
  children,
}: {
  title: string;
  count?: number;
  grid?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="text-sm text-muted tabular-nums">{count}</span>
        )}
      </div>
      <ul className={grid ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
        {children}
      </ul>
    </section>
  );
}

/** Same ticket everywhere: details, then a tear-off stub with the code (and its QR code while the event is to come). */
function TicketCard({
  ticket: { code, checkedInAt, event },
  now,
  past = false,
  size = 'regular',
}: {
  ticket: MyTicket;
  now: number;
  past?: boolean;
  size?: 'regular' | 'large';
}) {
  const large = size === 'large';
  return (
    <li
      className={`relative flex flex-col rounded-xl border bg-white shadow-sm sm:flex-row ${
        past ? 'border-line' : 'border-field'
      }`}
    >
      <div className="flex min-w-0 flex-1 gap-4 p-5 sm:p-6">
        <div
          aria-hidden="true"
          className={`flex shrink-0 flex-col items-center justify-center rounded-lg ${
            past ? 'bg-line-soft text-muted' : 'bg-brand-tint text-brand-deep'
          } ${large ? 'size-20' : 'size-16'}`}
        >
          <span
            className={`font-display leading-none font-bold ${large ? 'text-3xl' : 'text-2xl'}`}
          >
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
            {past && !checkedInAt && <span className="badge">Terminé</span>}
            {!past && !checkedInAt && (
              <span className="badge badge-brand">
                {proximity(event.startsAt, now, Infinity) ?? "Aujourd'hui"}
              </span>
            )}
          </div>
          <Link
            to={`/events/${event.id}`}
            className={`block leading-snug font-semibold ${
              past ? 'text-muted' : 'text-ink'
            } ${large ? 'text-2xl' : 'text-xl'}`}
          >
            {event.title}
          </Link>
          <p className="text-sm text-muted">
            {formatEventDate(event.startsAt)}
          </p>
          <p className="text-sm text-muted">{event.location}</p>
          {!past && !checkedInAt && Date.parse(event.startsAt) > now && (
            <div className="pt-2">
              <ConfirmButton
                compact
                label="Annuler la réservation"
                ariaLabel={`Annuler la réservation de ${event.title}`}
                question="Annuler cette réservation ?"
                details="Votre place sera libérée et votre code ne sera plus valable."
                onConfirm={async () => {
                  try {
                    await cancelTicket(event.id);
                    toast('Réservation annulée.');
                  } catch (err) {
                    const message = (err as Error).message;
                    void alertDialog({
                      title: 'Annulation impossible',
                      message: TICKET_ERRORS[message] ?? message,
                    });
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div
        className={`relative flex items-center gap-4 rounded-b-xl border-t-2 border-dashed p-5 sm:flex-col sm:justify-center sm:rounded-r-xl sm:rounded-bl-none sm:border-t-0 sm:border-l-2 sm:p-6 ${
          past
            ? 'justify-between border-line bg-canvas/70'
            : 'justify-between border-brand-edge bg-brand-tint/40'
        } ${large ? 'sm:w-72' : 'sm:w-52'}`}
      >
        {/* Notches of the tear-off stub: background-colored discs centered on the border of the ticket, without outline */}
        <span
          aria-hidden="true"
          className="absolute -top-[9px] -left-[10.5px] size-5 rounded-full bg-canvas sm:-top-[10.5px] sm:-left-[9px]"
        />
        <span
          aria-hidden="true"
          className="absolute -top-[9px] -right-[10.5px] size-5 rounded-full bg-canvas sm:top-auto sm:right-auto sm:-bottom-[10.5px] sm:-left-[9px]"
        />
        {!past && (
          <TicketQrCode
            code={code}
            className={`shrink-0 order-last sm:order-none ${large ? 'size-32' : 'size-24'}`}
          />
        )}
        <div className="min-w-0 space-y-0.5 sm:text-center">
          <p className="text-[13px] text-muted">Code du billet</p>
          <p>
            <strong className="font-mono text-lg tracking-wide break-all">
              {code}
            </strong>
          </p>
        </div>
      </div>
    </li>
  );
}
