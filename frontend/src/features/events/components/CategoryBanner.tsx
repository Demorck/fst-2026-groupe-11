import { CATEGORY_LABELS, CATEGORY_STYLES } from '../types.ts';
import type { EventCategory } from '../types.ts';

/** Tinted header of an event card: category pill and short date. */
export default function CategoryBanner({
  category,
  day,
}: {
  category: EventCategory;
  day: string;
}) {
  const { tint, ink } = CATEGORY_STYLES[category];
  return (
    <div
      className="flex h-30 flex-col justify-between p-4"
      style={{ backgroundColor: tint, color: ink }}
    >
      <span
        className="badge self-start bg-white text-[13px]"
        style={{ color: ink }}
      >
        {CATEGORY_LABELS[category]}
      </span>
      <span className="font-display text-[28px] leading-none font-bold">
        {day}
      </span>
    </div>
  );
}
