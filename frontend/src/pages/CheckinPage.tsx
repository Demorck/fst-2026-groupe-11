import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { getEvent } from '../features/events/api.ts';
import CheckinList from '../features/tickets/components/CheckinList.tsx';

interface Access {
  eventId: string;
  status: 'granted' | 'denied' | 'error';
}

/** Check-in of an event: for the organizers of its organizations only. */
export default function CheckinPage() {
  const { eventId = '' } = useParams();
  const [access, setAccess] = useState<Access | null>(null);
  // Goes up to read the event again after a failure
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    getEvent(eventId)
      .then(({ canManage }) => {
        if (!stale) {
          setAccess({ eventId, status: canManage ? 'granted' : 'denied' });
        }
      })
      .catch((err: Error) => {
        if (stale) return;
        // An unknown or forbidden event is a refusal; a network or server failure is not
        const refused =
          err instanceof ApiError && (err.status === 403 || err.status === 404);
        setAccess({ eventId, status: refused ? 'denied' : 'error' });
      });
    return () => {
      stale = true;
    };
  }, [eventId, attempt]);

  // Another event is being read: do not show the answer for the previous one
  if (access?.eventId !== eventId) {
    return <p className="text-muted">Chargement...</p>;
  }
  if (access.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="alert-error">
          Impossible de charger l'événement, réessayez plus tard.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Réessayer
        </button>
      </div>
    );
  }
  if (access.status === 'denied') {
    return (
      <p role="alert" className="alert-error">
        Accès refusé : seuls les gestionnaires d'une organisation de cet
        événement font le check-in.
      </p>
    );
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex min-h-11 items-center self-start text-sm"
      >
        ← Retour à l'événement
      </Link>
      <h1 className="page-title">Check-in</h1>
      <CheckinList eventId={eventId} />
    </div>
  );
}
