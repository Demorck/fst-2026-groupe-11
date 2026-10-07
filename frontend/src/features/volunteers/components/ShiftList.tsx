import type { Shift } from '../types.ts';

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const actionClass =
  'min-h-11 rounded-lg border border-gray-300 bg-white px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

interface ShiftListProps {
  shifts: Shift[];
  /** Organizer actions, hidden when missing */
  onEdit?: (shift: Shift) => void;
  onDelete?: (shift: Shift) => void;
}

export default function ShiftList({
  shifts,
  onEdit,
  onDelete,
}: ShiftListProps) {
  if (shifts.length === 0) {
    return <p>Aucun créneau pour cet événement.</p>;
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {shifts.map((shift) => {
        const full = shift.registered >= shift.requiredVolunteers;
        const fill = Math.min(
          Math.round((shift.registered / shift.requiredVolunteers) * 100),
          100,
        );
        return (
          <li
            key={shift.id}
            className={`flex flex-wrap items-center gap-x-6 gap-y-3.5 rounded-xl border bg-white px-5 py-4 ${
              shift.assigned ? 'border-indigo-600' : 'border-gray-200'
            }`}
          >
            <div className="w-30 shrink-0">
              <div className="text-sm text-gray-600">
                {formatDay(shift.startsAt)}
              </div>
              <div className="text-[22px] font-bold">
                {formatTime(shift.startsAt)}
              </div>
              <div className="text-sm text-gray-600">
                → {formatTime(shift.endsAt)}
              </div>
            </div>
            <div className="flex min-w-60 flex-[999_1_240px] flex-col gap-2">
              <h2 className="text-lg font-semibold">{shift.title}</h2>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 w-36 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-1.5 ${full ? 'bg-green-800' : 'bg-indigo-600'}`}
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {shift.registered} / {shift.requiredVolunteers} bénévoles
                </span>
              </div>
              {shift.assigned && (
                <p className="text-sm font-medium text-indigo-700">
                  Vous êtes inscrit
                </p>
              )}
            </div>
            {(onEdit || onDelete) && (
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(shift)}
                    aria-label={`Modifier ${shift.title}`}
                    className={actionClass}
                  >
                    Modifier
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(shift)}
                    aria-label={`Supprimer ${shift.title}`}
                    className={`${actionClass} text-red-700`}
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
