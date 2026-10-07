import { useParams } from 'react-router';
import ReserveButton from '../features/tickets/components/ReserveButton.tsx';

export default function EventDetailPage() {
  const { eventId } = useParams();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Détail de l'événement</h1>
      {eventId && <ReserveButton eventId={eventId} />}
    </div>
  );
}
