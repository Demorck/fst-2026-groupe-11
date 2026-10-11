import { Link, useParams } from 'react-router';
import CheckinList from '../features/tickets/components/CheckinList.tsx';

export default function CheckinPage() {
  const { eventId = '' } = useParams();

  return (
    <div className="space-y-4">
      <Link to={`/events/${eventId}`} className="underline">
        Retour à l'événement
      </Link>
      <h1 className="text-2xl font-semibold">Check-in</h1>
      <CheckinList eventId={eventId} />
    </div>
  );
}
