import { Link, useParams } from 'react-router';
import CheckinList from '../features/tickets/components/CheckinList.tsx';

export default function CheckinPage() {
  const { eventId = '' } = useParams();

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
