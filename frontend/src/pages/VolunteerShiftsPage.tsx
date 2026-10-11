import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { alertDialog, confirm, toast } from '../components/dialogs.ts';
import ProgressBar from '../components/ProgressBar.tsx';
import { hasRole } from '../features/auth/types.ts';
import { useAuth } from '../features/auth/useAuth.ts';
import { getEvent } from '../features/events/api.ts';
import { formatEventDate } from '../features/events/types.ts';
import type { EventWithAccess } from '../features/events/types.ts';
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
  'Shift already ended': 'Ce créneau est terminé.',
  'Shift already started':
    "Ce créneau a commencé : la désinscription n'est plus possible.",
  'Already registered': 'Vous êtes déjà inscrit sur ce créneau.',
  'Overlaps another of your shifts':
    'Ce créneau chevauche un autre de vos créneaux.',
  'Not a volunteer of an organization of this event':
    "Vous n'êtes bénévole d'aucune organisation de cet événement.",
};

export default function VolunteerShiftsPage() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const isVolunteer = hasRole(user?.role, 'VOLUNTEER');
  const [busy, setBusy] = useState(false);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Context line under the title: optional, the page works without it
  const [event, setEvent] = useState<EventWithAccess | null>(null);
  useDocumentTitle('Créneaux bénévoles');
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

  useEffect(() => {
    getEvent(eventId)
      .then(setEvent)
      .catch(() => undefined);
  }, [eventId]);

  async function save(input: ShiftInput) {
    if (editing === 'new') {
      await createShift(eventId, input);
    } else if (editing) {
      await updateShift(editing.id, input);
    }
    toast(editing === 'new' ? 'Créneau ajouté.' : 'Créneau enregistré.');
    setEditing(null);
    await load();
  }

  async function remove(shift: Shift) {
    const confirmed = await confirm({
      title: `Supprimer le créneau « ${shift.title} » ?`,
      message: 'Les bénévoles inscrits sur ce créneau en seront retirés.',
    });
    if (!confirmed) return;
    try {
      await deleteShift(shift.id);
      await load();
      toast('Créneau supprimé.');
    } catch (err) {
      void alertDialog({ message: (err as Error).message });
    }
  }

  async function toggle(shift: Shift) {
    setBusy(true);
    try {
      await (shift.assigned ? leaveShift(shift.id) : joinShift(shift.id));
    } catch (err) {
      const message = (err as Error).message;
      void alertDialog({
        title: shift.assigned
          ? 'Désinscription impossible'
          : 'Inscription impossible',
        message: ERROR_MESSAGES[message] ?? message,
      });
    }
    // reload even after a refusal: the shift may have filled up meanwhile
    await load();
    setBusy(false);
  }

  // Only the managers of the event edit its shifts (the API refuses the other organizers)
  const canManage = user?.role === 'ORGANIZER' && event?.canManage === true;
  const mine = shifts?.filter((s) => s.assigned).length ?? 0;
  const required = shifts?.reduce((n, s) => n + s.requiredVolunteers, 0) ?? 0;
  const registered = shifts?.reduce((n, s) => n + s.registered, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex min-h-11 items-center text-sm"
      >
        ← Retour à l'événement
      </Link>
      <div>
        <h1 className="page-title">Créneaux bénévoles</h1>
        {event?.title && (
          <p className="page-subtitle">
            {event.title} · {formatEventDate(event.startsAt)} · {event.location}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {!error && !shifts && <p className="text-muted">Chargement...</p>}
      {shifts && (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <ShiftList
              shifts={shifts}
              onEdit={canManage ? setEditing : undefined}
              onDelete={canManage ? (s) => void remove(s) : undefined}
              onJoin={isVolunteer ? (s) => void toggle(s) : undefined}
              onLeave={isVolunteer ? (s) => void toggle(s) : undefined}
              busy={busy}
            />
          </div>
          <aside className="space-y-4 max-lg:order-first lg:sticky lg:top-24">
            {required > 0 && (
              <section className="card space-y-3">
                <h2 className="text-sm text-muted">Couverture</h2>
                <p className="font-display text-3xl font-bold">
                  {registered} / {required}
                </p>
                <ProgressBar
                  value={registered}
                  max={required}
                  label="Couverture des créneaux"
                  className={registered < required ? 'progress-warn' : ''}
                />
                <p className="text-sm text-muted">
                  {registered < required
                    ? `Il manque ${required - registered} bénévole(s) sur l'ensemble des créneaux.`
                    : 'Tous les créneaux sont couverts.'}
                </p>
              </section>
            )}
            {canManage &&
              (editing ? (
                <ShiftForm
                  key={editing === 'new' ? 'new' : editing.id}
                  shift={editing === 'new' ? undefined : editing}
                  onSave={save}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="btn btn-primary w-full"
                >
                  + Ajouter un créneau
                </button>
              ))}
            {isVolunteer && (
              <p className="card text-sm text-muted">
                Vous êtes inscrit sur{' '}
                <strong className="text-ink">{mine}</strong> créneau(x)
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
