import { useState } from 'react';
import { Link } from 'react-router';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { reserveTicket } from '../api.ts';
import type { Ticket } from '../types.ts';
import TicketQrCode from './TicketQrCode.tsx';

// The API answers in English, the interface speaks French
const ERROR_MESSAGES: Record<string, string> = {
  'Event is full': 'Cet événement est complet.',
  'Ticket already booked':
    'Vous avez déjà réservé une place pour cet événement.',
};

const buttonClass =
  'rounded px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60';

/** Ticket booking for the event detail page, with a confirmation step before the API call. */
export default function ReserveButton({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const { submit, pending, error } = useSubmit(async () => {
    try {
      setTicket(await reserveTicket(eventId));
    } finally {
      setConfirming(false);
    }
  });

  if (!user) {
    return (
      <Link to="/login" className="underline">
        Connectez-vous pour réserver
      </Link>
    );
  }
  // organizers and volunteers have no ticket: the API refuses them
  if (user.role !== 'PARTICIPANT') return null;

  if (ticket) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-green-700">
          Votre place est réservée. Votre code : <strong>{ticket.code}</strong>
        </p>
        <TicketQrCode code={ticket.code} />
        <Link to="/me/tickets" className="underline">
          Voir mes billets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-red-600">
          {ERROR_MESSAGES[error] ?? error}
        </p>
      )}
      {confirming ? (
        <div className="space-y-2">
          <p>Confirmer la réservation d'une place ?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className={`${buttonClass} bg-indigo-600 text-white`}
            >
              {pending ? 'Réservation...' : 'Confirmer'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className={`${buttonClass} border border-gray-300 bg-white`}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${buttonClass} bg-indigo-600 text-white`}
        >
          Réserver
        </button>
      )}
    </div>
  );
}
