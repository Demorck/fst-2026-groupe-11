import type { VolunteerStatus } from '../types.ts';

const BADGES: Record<VolunteerStatus, { text: string; className: string }> = {
  ASSIGNED: {
    text: 'Vous êtes bénévole sur cet événement',
    className: 'badge-ok',
  },
  AVAILABLE: {
    text: 'Vous pouvez vous inscrire comme bénévole',
    className: 'badge',
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
  return <span className={`badge ${className}`}>{text}</span>;
}
