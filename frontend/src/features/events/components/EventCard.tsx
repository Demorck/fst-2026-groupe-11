import { Link } from 'react-router';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import VolunteerBadge from '../../organizations/components/VolunteerBadge.tsx';
import { CATEGORY_LABELS, formatEventDate } from '../types.ts';
import type { EventWithSeats } from '../types.ts';

export default function EventCard({ event }: { event: EventWithSeats }) {
  return (
    <li className="rounded bg-white p-4 shadow">
      <Link
        to={`/events/${event.id}`}
        className="text-lg font-semibold text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        {event.title}
      </Link>
      <p className="text-sm text-gray-600">
        {formatEventDate(event.startsAt)} · {event.location}
      </p>
      <p className="mt-2 flex gap-3 text-sm">
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700">
          {CATEGORY_LABELS[event.category]}
        </span>
        <span>
          {event.remainingSeats > 0
            ? `${event.remainingSeats} place(s) restante(s)`
            : 'Complet'}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <OrganizationBubbles organizations={event.organizations} />
        <VolunteerBadge status={event.volunteerStatus} />
      </div>
    </li>
  );
}
