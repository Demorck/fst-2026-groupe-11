import { CATEGORY_LABELS, CATEGORY_STYLES } from '../types.ts';
import type { EventCategory } from '../types.ts';

/** Tinted header of an event card: category pill and short date. */
export default function CategoryBanner({
  category,
  day,
  hint,
  className = 'h-30',
}: {
  category: EventCategory;
  day: string;
  /** Short note next to the category: "Demain", "Dans 5 jours". */
  hint?: string | null;
  className?: string;
}) {
  const { tint, ink } = CATEGORY_STYLES[category];
  return (
    <div
      className={`flex flex-col justify-between gap-4 p-4 ${className}`}
      style={{ backgroundColor: tint, color: ink }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-white text-[13px]" style={{ color: ink }}>
          {CATEGORY_LABELS[category]}
        </span>
        {hint && (
          <span className="badge bg-ink text-[13px] text-white">{hint}</span>
        )}
      </div>
      <span className="font-display text-[28px] leading-none font-bold">
        {day}
      </span>
    </div>
  );
}
