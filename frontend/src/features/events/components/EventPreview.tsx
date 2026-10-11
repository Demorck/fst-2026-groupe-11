import ProgressBar from '../../../components/ProgressBar.tsx';
import { formatEventDate, formatShortDay } from '../types.ts';
import type { EventCategory } from '../types.ts';
import CategoryBanner from './CategoryBanner.tsx';

/** Live look of the event card while the organizer fills the creation form. */
export default function EventPreview({
  title,
  category,
  startsAt,
  location,
  capacity,
}: {
  title: string;
  category: EventCategory;
  /** Value of a datetime-local input, empty until filled. */
  startsAt: string;
  location: string;
  capacity: number;
}) {
  const start = startsAt ? new Date(startsAt) : null;
  const valid = start !== null && !Number.isNaN(start.getTime());
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-line bg-white"
    >
      <CategoryBanner
        category={category}
        day={valid ? formatShortDay(start.toISOString()) : 'Date à choisir'}
      />
      <div className="space-y-2.5 px-[18px] pt-4 pb-[18px]">
        <p className="text-[19px] leading-snug font-semibold">
          {title || 'Titre de votre événement'}
        </p>
        <p className="text-sm text-muted">
          {valid ? formatEventDate(start.toISOString()) : 'Date et heure'} ·{' '}
          {location || 'Lieu'}
        </p>
        <ProgressBar value={0} max={Math.max(capacity, 1)} label="Aperçu" />
        <p className="text-[13px] text-muted">
          {capacity > 0 ? `${capacity} place(s) restante(s)` : 'Capacité'}
        </p>
      </div>
    </div>
  );
}
