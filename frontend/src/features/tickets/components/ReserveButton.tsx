import { useState } from 'react';
import { useNow } from '../../../hooks/useNow.ts';
import { Link } from 'react-router';
import { alertDialog, confirm, toast } from '../../../components/dialogs.ts';
import Modal from '../../../components/Modal.tsx';
import { useAuth } from '../../auth/useAuth.ts';
import { TICKET_ERRORS } from '../messages.ts';
import { bookTicket, cancelTicket, useMyTickets } from '../store.ts';
import TicketQrCode from './TicketQrCode.tsx';

/**
 * Booking and cancelling for the event detail page. The ticket held comes from the shared store,
 * so the button, the code and the seats follow every change made anywhere on the site.
 */
export default function ReserveButton({
  eventId,
  startsAt,
  full,
}: {
  eventId: string;
  startsAt: string;
  full: boolean;
}) {
  const { user } = useAuth();
  const { tickets, error } = useMyTickets(!!user);
  // The modal that shows the new ticket, until it is closed
  const [shown, setShown] = useState<{ code: string } | null>(null);
  const [pending, setPending] = useState(false);
  const now = useNow();
  // The API refuses both booking and cancelling once the event has started
  const started = Date.parse(startsAt) <= now;

  async function reserve() {
    const confirmed = await confirm({
      title: 'Réserver une place pour cet événement ?',
      message: 'La place est gratuite, avec un seul billet par compte.',
      tone: 'primary',
    });
    if (!confirmed) return;
    setPending(true);
    try {
      setShown(await bookTicket(eventId));
    } catch (err) {
      const message = (err as Error).message;
      void alertDialog({
        title: 'Réservation impossible',
        message: TICKET_ERRORS[message] ?? message,
      });
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    const confirmed = await confirm({
      title: 'Annuler votre réservation ?',
      message: 'Votre place sera libérée et votre code ne sera plus valable.',
      confirmLabel: 'Annuler la réservation',
    });
    if (!confirmed) return;
    setPending(true);
    try {
      await cancelTicket(eventId);
      toast('Réservation annulée.');
    } catch (err) {
      const message = (err as Error).message;
      void alertDialog({
        title: 'Annulation impossible',
        message: TICKET_ERRORS[message] ?? message,
      });
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return (
      <Link to="/login" className="btn btn-primary w-full">
        Connectez-vous pour réserver
      </Link>
    );
  }
  const held = tickets?.find(({ event }) => event.id === eventId);
  if (held) {
    return (
      <>
        {shown && (
          <Modal title="Place réservée !" onClose={() => setShown(null)}>
            <p className="mt-1 text-muted">
              Présentez ce code à l'entrée de l'événement.
            </p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-dashed border-brand-edge bg-brand-tint/50 p-4">
              <div className="min-w-0">
                <p className="text-[13px] text-muted">Code du billet</p>
                <p className="font-mono text-xl font-semibold tracking-wide break-all">
                  {held.code}
                </p>
              </div>
              <TicketQrCode code={held.code} className="size-24 shrink-0" />
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                data-autofocus
                className="btn btn-secondary"
                onClick={() => setShown(null)}
              >
                Fermer
              </button>
              <Link to="/me/tickets" className="btn btn-primary">
                Voir mes billets
              </Link>
            </div>
          </Modal>
        )}
        {!shown && (
          <div className="space-y-3">
            <p
              role="status"
              className="rounded-[10px] bg-ok-bg p-4 text-ok-ink"
            >
              Votre place est réservée. Votre code :{' '}
              <strong className="font-mono text-xl tracking-wide">
                {held.code}
              </strong>
            </p>
            <TicketQrCode code={held.code} />
            <Link to="/me/tickets" className="btn btn-secondary w-full">
              Voir mes billets
            </Link>
            {!started && (
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={pending}
                className="btn btn-danger-outline w-full"
              >
                Annuler ma réservation
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  if (started) {
    return (
      <p className="text-sm text-muted">
        Les réservations sont fermées : l'événement a commencé.
      </p>
    );
  }

  // The API refuses it anyway: do not offer a booking that cannot succeed
  if (full) {
    return (
      <p className="text-sm text-muted">
        L'événement est complet : plus aucune place à réserver.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void reserve()}
      // booking waits for the list of tickets already held; if it cannot be read, the API still refuses a duplicate
      disabled={(tickets === null && error === null) || pending}
      className="btn btn-primary w-full"
    >
      {pending ? 'Réservation...' : 'Réserver'}
    </button>
  );
}
