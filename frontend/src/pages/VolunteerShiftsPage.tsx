import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../features/auth/useAuth.ts';
import {
  createShift,
  deleteShift,
  joinShift,
  leaveShift,
  listShifts,
  updateShift,
} from '../features/volunteers/api.ts';
import ShiftForm from '../features/volunteers/components/ShiftForm.tsx';
import ShiftList from '../features/volunteers/components/ShiftList.tsx';
import type { Shift, ShiftInput } from '../features/volunteers/types.ts';

// The API answers in English, the interface speaks French
const ERROR_MESSAGES: Record<string, string> = {
  'Shift is full': 'Ce créneau est complet.',
  'Already registered': 'Vous êtes déjà inscrit sur ce créneau.',
  'Overlaps another of your shifts':
    'Ce créneau chevauche un autre de vos créneaux.',
  'Not a volunteer of an organization of this event':
    "Vous n'êtes bénévole d'aucune organisation de cet événement.",
};

export default function VolunteerShiftsPage() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const isOrganizer = user?.role === 'ORGANIZER';
  const isVolunteer = user?.role === 'VOLUNTEER';
  const [busy, setBusy] = useState(false);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the shift being edited, 'new' for the creation form, none when closed
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);

  const load = useCallback(
    () =>
      listShifts(eventId)
        .then(setShifts)
        .catch((err: Error) => setError(err.message)),
    [eventId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function save(input: ShiftInput) {
    if (editing === 'new') {
      await createShift(eventId, input);
    } else if (editing) {
      await updateShift(editing.id, input);
    }
    setEditing(null);
    await load();
  }

  async function remove(shift: Shift) {
    if (!window.confirm(`Supprimer le créneau « ${shift.title} » ?`)) return;
    setError(null);
    try {
      await deleteShift(shift.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(shift: Shift) {
    setBusy(true);
    setError(null);
    try {
      await (shift.assigned ? leaveShift(shift.id) : joinShift(shift.id));
    } catch (err) {
      const message = (err as Error).message;
      setError(ERROR_MESSAGES[message] ?? message);
    }
    // reload even after a refusal: the shift may have filled up meanwhile
    await load();
    setBusy(false);
  }

  const mine = shifts?.filter((s) => s.assigned).length ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        to={`/events/${eventId}`}
        className="self-start py-2 text-sm text-indigo-700 hover:underline"
      >
        ← Retour à l'événement
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold">Créneaux bénévoles</h1>
        {isOrganizer ? (
          !editing && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="min-h-11 rounded-[10px] bg-indigo-600 px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              + Ajouter un créneau
            </button>
          )
        ) : (
          <span className="text-sm text-gray-600">
            Vous êtes inscrit sur{' '}
            <strong className="text-gray-900">{mine}</strong> créneau(x)
          </span>
        )}
      </div>
      {editing && (
        <ShiftForm
          key={editing === 'new' ? 'new' : editing.id}
          shift={editing === 'new' ? undefined : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!error && !shifts && <p>Chargement...</p>}
      {shifts && (
        <ShiftList
          shifts={shifts}
          onEdit={isOrganizer ? setEditing : undefined}
          onDelete={isOrganizer ? (s) => void remove(s) : undefined}
          onJoin={isVolunteer ? (s) => void toggle(s) : undefined}
          onLeave={isVolunteer ? (s) => void toggle(s) : undefined}
          busy={busy}
        />
      )}
    </div>
  );
}
