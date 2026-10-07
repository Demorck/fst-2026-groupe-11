import { Link } from 'react-router';
import { useSession } from '../../auth/session.ts';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import VolunteerBadge from '../../organizations/components/VolunteerBadge.tsx';
import ProgressBar from '../../../components/ProgressBar.tsx';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  formatEventDate,
  formatShortDay,
} from '../types.ts';
import type { EventWithSeats } from '../types.ts';

export default function EventCard({ event }: { event: EventWithSeats }) {
  const role = useSession()?.user.role;
  // The call for volunteers is for those who can answer it
  const recruiting =
    event.volunteers.missing > 0 &&
    (role === 'VOLUNTEER' || role === 'ORGANIZER');

  const { tint, ink } = CATEGORY_STYLES[event.category];
  const taken = event.capacity - event.remainingSeats;

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div
        className="flex h-30 flex-col justify-between p-4"
        style={{ backgroundColor: tint, color: ink }}
      >
        <span
          className="badge self-start bg-white text-[13px]"
          style={{ color: ink }}
        >
          {CATEGORY_LABELS[event.category]}
        </span>
        <span className="font-display text-[28px] leading-none font-bold">
          {formatShortDay(event.startsAt)}
        </span>
      </div>
      <div className="flex grow flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <h2 className="text-[19px] leading-snug font-semibold">
          <Link
            to={`/events/${event.id}`}
            className="text-ink hover:text-brand hover:underline"
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
          <OrganizationBubbles organizations={event.organizations} />
          <VolunteerBadge status={event.volunteerStatus} />
        </div>
      </div>
    </li>
  );
}
