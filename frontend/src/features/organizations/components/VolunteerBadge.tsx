import type { VolunteerStatus } from '../types.ts';

const BADGES: Record<VolunteerStatus, { text: string; className: string }> = {
  ASSIGNED: {
    text: 'Vous êtes bénévole sur cet événement',
    className: 'bg-green-100 text-green-800',
  },
  AVAILABLE: {
    text: 'Vous pouvez bénévoler à cet événement',
    className: 'bg-gray-100 text-gray-600',
  },
};

/** Green when the volunteer already works on the event, grey when they could. Nothing otherwise. */
export default function VolunteerBadge({
  status,
}: {
  status?: VolunteerStatus | null;
}) {
  if (!status) return null;
  const { text, className } = BADGES[status];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {text}
    </span>
  );
}
