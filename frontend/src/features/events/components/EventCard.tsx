import { Link } from 'react-router';
import { useSession } from '../../auth/session.ts';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import VolunteerBadge from '../../organizations/components/VolunteerBadge.tsx';
import CategoryBanner from './CategoryBanner.tsx';
import ProgressBar from '../../../components/ProgressBar.tsx';
import { formatEventDate, formatShortDay } from '../types.ts';
import type { EventWithSeats } from '../types.ts';

export default function EventCard({ event }: { event: EventWithSeats }) {
  const role = useSession()?.user.role;
  // The call for volunteers is for those who can answer it
  const recruiting =
    event.volunteers.missing > 0 &&
    (role === 'VOLUNTEER' || role === 'ORGANIZER');

  const taken = event.capacity - event.remainingSeats;

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand motion-safe:transition motion-safe:duration-150 hover:border-brand-edge hover:shadow-lg hover:shadow-ink/5 motion-safe:hover:-translate-y-0.5">
      <CategoryBanner
        category={event.category}
        day={formatShortDay(event.startsAt)}
      />
      <div className="flex grow flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <h2 className="text-[19px] leading-snug font-semibold">
          <Link
            to={`/events/${event.id}`}
            className="text-ink after:absolute after:inset-0 group-hover:text-brand group-hover:underline hover:text-brand"
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
          />
          <p className="text-[13px] text-muted">
            {event.remainingSeats > 0
              ? `${event.remainingSeats} place(s) restante(s)`
              : 'Complet'}
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
          <VolunteerBadge status={event.volunteerStatus} />
        </div>
      </div>
    </li>
  );
}
