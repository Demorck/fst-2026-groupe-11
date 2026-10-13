import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { getEvent } from '../features/events/api.ts';
import CreateEventForm from '../features/events/components/CreateEventForm.tsx';
import type { EventWithAccess } from '../features/events/types.ts';
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import NotFoundPage from './NotFoundPage.tsx';

export default function EditEventPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventWithAccess | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useDocumentTitle('Modifier un événement');

  useEffect(() => {
    let stale = false;
    getEvent(eventId)
      .then((found) => !stale && setEvent(found))
      .catch((err: Error) => !stale && setError(err));
    return () => {
      stale = true;
    };
  }, [eventId]);

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />;
  }
  if (error) {
    return (
      <p role="alert" className="alert-error">
        Impossible de charger l'événement, réessayez plus tard.
      </p>
    );
  }
  if (!event || event.id !== eventId) {
    return <p className="text-muted">Chargement...</p>;
  }
  if (!event.canManage) {
    return (
      <p role="alert" className="alert-error">
        Accès refusé : seuls les gestionnaires d'une organisation de cet
        événement peuvent le modifier.
      </p>
    );
  }
  return (
    <div className="space-y-7">
      <h1 className="page-title">Modifier l'événement</h1>
      {/* key: another event starts from its own values */}
      <CreateEventForm key={event.id} event={event} />
    </div>
  );
}
