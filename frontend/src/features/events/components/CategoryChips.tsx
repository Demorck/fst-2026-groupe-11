import type { CSSProperties } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  EVENT_CATEGORIES,
} from '../types.ts';
import type { EventCategory } from '../types.ts';

/** Category radio pills, tinted like the event banners. `allLabel` adds a "no filter" pill (value null). */
export default function CategoryChips({
  name,
  legend,
  value,
  onChange,
  allLabel,
}: {
  name: string;
  legend: string;
  value: EventCategory | null;
  onChange: (category: EventCategory | null) => void;
  allLabel?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium empty:hidden">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {allLabel && (
          <label className="chip">
            <input
              type="radio"
              name={name}
              checked={value === null}
              onChange={() => onChange(null)}
              className="sr-only"
            />
            {allLabel}
          </label>
        )}
        {EVENT_CATEGORIES.map((c) => (
          <label
            key={c}
            className="chip has-[:checked]:border-(--ink) has-[:checked]:bg-(--tint) has-[:checked]:text-(--ink)"
            style={
              {
                '--tint': CATEGORY_STYLES[c].tint,
                '--ink': CATEGORY_STYLES[c].ink,
              } as CSSProperties
            }
          >
            <input
              type="radio"
              name={name}
              value={c}
              checked={value === c}
              onChange={() => onChange(c)}
              className="sr-only"
            />
            {CATEGORY_LABELS[c]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
