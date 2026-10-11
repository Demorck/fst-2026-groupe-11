import { useState } from 'react';
import { Link } from 'react-router';
import ProgressBar from '../../../components/ProgressBar.tsx';
import { useSession } from '../../auth/session.ts';
import { hasRole } from '../../auth/types.ts';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import VolunteerBadge from '../../organizations/components/VolunteerBadge.tsx';
import { useHeldTicket } from '../../tickets/store.ts';
import { formatEventDate, formatShortDay, proximity } from '../types.ts';
import type { EventWithSeats } from '../types.ts';
import CategoryBanner from './CategoryBanner.tsx';

/** Under this share of free seats, the event is about to be full. */
const LAST_SEATS = 0.1;

export default function EventCard({
  event,
  featured = false,
}: {
  event: EventWithSeats;
  /** The next event, wide: banner on the left, details on the right. */
  featured?: boolean;
}) {
  const role = useSession()?.user.role;
  const [now] = useState(Date.now);
  const { held, loading: ticketsLoading } = useHeldTicket(event.id);
  // The call for volunteers is for those who can answer it
  const recruiting = event.volunteers.missing > 0 && hasRole(role, 'VOLUNTEER');

  const taken = event.capacity - event.remainingSeats;
  const full = event.remainingSeats === 0;
  const lastSeats =
    !full && event.remainingSeats <= event.capacity * LAST_SEATS;

  return (
    <li
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgb(22_24_29/0.06)] focus-within:border-brand motion-safe:transition motion-safe:duration-150 hover:border-brand-edge hover:shadow-lg hover:shadow-ink/5 motion-safe:hover:-translate-y-0.5 ${
        featured ? 'col-span-full md:flex-row' : ''
      }`}
    >
      <CategoryBanner
        category={event.category}
        day={formatShortDay(event.startsAt)}
        hint={proximity(event.startsAt, now)}
        className={featured ? 'h-30 md:h-auto md:w-72 md:shrink-0' : 'h-30'}
      />
      <div
        className={`flex grow flex-col gap-2.5 px-[18px] pt-4 pb-[18px] ${
          featured ? 'md:justify-center md:gap-3 md:p-6' : ''
        }`}
      >
        <h2
          className={`leading-snug font-semibold ${
            featured ? 'text-[19px] md:text-3xl' : 'text-[19px]'
          }`}
        >
          <Link
            to={`/events/${event.id}`}
            className="text-ink after:absolute after:inset-0"
          >
            {event.title}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {formatEventDate(event.startsAt)} · {event.location}
        </p>
        <div className="mt-auto space-y-1.5">
          <ProgressBar
            value={taken}
            max={event.capacity}
            label={`Remplissage de ${event.title}`}
            className={featured ? 'md:max-w-md' : ''}
          />
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>
              {event.remainingSeats > 0
                ? `${event.remainingSeats} place(s) restante(s)`
                : 'Complet'}
            </span>
            {lastSeats && (
              <span className="badge badge-warn">Dernières places</span>
            )}
          </p>
        </div>
        {recruiting && (
          <p className="text-sm font-medium text-warn-ink">
            Il manque {event.volunteers.missing} bénévole(s)
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* above the stretched title link, so that each bubble stays clickable */}
          <div className="relative z-10">
            <OrganizationBubbles organizations={event.organizations} max={3} />
          </div>
          <div className="flex flex-wrap gap-2">
            {held ? (
              <span className="badge badge-ok">Vous avez un billet</span>
            ) : (
              full &&
              !ticketsLoading && (
                <span className="badge badge-danger">
                  Aucun billet n'est disponible
                </span>
              )
            )}
            <VolunteerBadge status={event.volunteerStatus} />
          </div>
        </div>
      </div>
    </li>
  );
}
