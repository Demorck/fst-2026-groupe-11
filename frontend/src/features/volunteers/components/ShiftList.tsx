import { useNow } from '../../../hooks/useNow.ts';
import type { Shift } from '../types.ts';

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

interface ShiftListProps {
  shifts: Shift[];
  /** Organizer actions, hidden when missing */
  onEdit?: (shift: Shift) => void;
  onDelete?: (shift: Shift) => void;
  /** Volunteer sign-up actions, hidden when missing */
  onJoin?: (shift: Shift) => void;
  onLeave?: (shift: Shift) => void;
  /** Locks the sign-up buttons while a request runs */
  busy?: boolean;
}

export default function ShiftList({
  shifts,
  onEdit,
  onDelete,
  onJoin,
  onLeave,
  busy,
}: ShiftListProps) {
  const now = useNow();
  if (shifts.length === 0) {
    return <p className="card text-muted">Aucun créneau pour cet événement.</p>;
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {shifts.map((shift) => {
        const full = shift.registered >= shift.requiredVolunteers;
        // Past shifts are history (hours, attestation): the API refuses a new sign-up
        const ended = Date.parse(shift.endsAt) <= now;
        const fill = Math.min(
          Math.round((shift.registered / shift.requiredVolunteers) * 100),
          100,
        );
        return (
          <li
            key={shift.id}
            className={`flex flex-wrap items-center gap-x-6 gap-y-3.5 rounded-xl border bg-white px-5 py-4 ${
              shift.assigned ? 'border-brand' : 'border-line'
            }`}
          >
            <div className="w-30 shrink-0">
              <div className="text-sm text-muted">
                {formatDay(shift.startsAt)}
              </div>
              <div className="font-display text-[22px] font-bold">
                {formatTime(shift.startsAt)}
              </div>
              <div className="text-sm text-muted">
                → {formatTime(shift.endsAt)}
              </div>
            </div>
            <div className="flex min-w-60 flex-[999_1_240px] flex-col gap-2">
              <h2 className="text-lg font-semibold">{shift.title}</h2>
              <div className="flex items-center gap-2.5">
                <div className="progress w-36">
                  <div
                    className={`progress-bar ${full ? 'bg-ok-ink' : ''}`}
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <span className="text-sm text-muted">
                  {shift.registered} / {shift.requiredVolunteers} bénévoles
                </span>
              </div>
              {shift.assigned && (
                <p className="text-sm font-medium text-brand-deep">
                  Vous êtes inscrit
                </p>
              )}
            </div>
            {onJoin && onLeave && (
              <div className="flex w-45 justify-end">
                {ended ? (
                  <span className="badge">Terminé</span>
                ) : shift.assigned ? (
                  <button
                    type="button"
                    onClick={() => onLeave(shift)}
                    disabled={busy}
                    className="btn btn-secondary font-normal"
                  >
                    Se désinscrire
                  </button>
                ) : full ? (
                  <button
                    type="button"
                    disabled
                    className="btn bg-line-soft text-muted"
                  >
                    Complet
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onJoin(shift)}
                    disabled={busy}
                    className="btn btn-primary"
                  >
                    S'inscrire
                  </button>
                )}
              </div>
            )}
            {(onEdit || onDelete) && (
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(shift)}
                    aria-label={`Modifier ${shift.title}`}
                    className="btn btn-secondary font-normal"
                  >
                    Modifier
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(shift)}
                    aria-label={`Supprimer ${shift.title}`}
                    className="btn btn-danger-outline font-normal"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
