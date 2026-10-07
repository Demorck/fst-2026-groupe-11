import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { getMyTickets, reserveTicket } from '../api.ts';
import type { Ticket } from '../types.ts';
import TicketQrCode from './TicketQrCode.tsx';

// The API answers in English, the interface speaks French
const ERROR_MESSAGES: Record<string, string> = {
  'Event is full': 'Cet événement est complet.',
  'Ticket already booked':
    'Vous avez déjà réservé une place pour cet événement.',
};

/** Ticket booking for the event detail page, with a confirmation step before the API call. */
export default function ReserveButton({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [ticket, setTicket] = useState<Pick<Ticket, 'code'> | null>(null);
  // undefined while we look for a ticket already held: booking waits for the answer
  const [held, setHeld] = useState<Pick<Ticket, 'code'> | null | undefined>();
  const isParticipant = user?.role === 'PARTICIPANT';
  const { submit, pending, error } = useSubmit(async () => {
    try {
      setTicket(await reserveTicket(eventId));
    } finally {
      setConfirming(false);
    }
  });

  useEffect(() => {
    if (!isParticipant) return;
    getMyTickets()
      .then((mine) =>
        setHeld(mine.find(({ event }) => event.id === eventId) ?? null),
      )
      // the API refuses a duplicate booking anyway
      .catch(() => setHeld(null));
  }, [eventId, isParticipant]);

  if (!user) {
    return (
      <Link to="/login" className="btn btn-primary w-full">
        Connectez-vous pour réserver
      </Link>
    );
  }
  // organizers and volunteers have no ticket: the API refuses them
  if (user.role !== 'PARTICIPANT') return null;

  const booked = ticket ?? held;
  if (booked) {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-[10px] bg-ok-bg p-4 text-ok-ink">
          Votre place est réservée. Votre code :{' '}
          <strong className="font-mono text-xl tracking-wide">
            {booked.code}
          </strong>
        </p>
        <TicketQrCode code={booked.code} />
        <Link to="/me/tickets" className="btn btn-secondary">
          Voir mes billets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="alert-error">
          {ERROR_MESSAGES[error] ?? error}
        </p>
      )}
      {confirming ? (
        <div className="space-y-2">
          <p>Confirmer la réservation d'une place ?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="btn btn-primary"
            >
              {pending ? 'Réservation...' : 'Confirmer'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="btn btn-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={held === undefined}
          className="btn btn-primary w-full"
        >
          Réserver
        </button>
      )}
    </div>
  );
}
