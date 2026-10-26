import { useEffect, useState } from 'react';
import { ApiError } from '../../../api/client.ts';
import { checkIn, getEventTickets } from '../api.ts';
import type { CheckinTicket } from '../types.ts';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { timeStyle: 'short' });

export default function CheckinList({ eventId }: { eventId: string }) {
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<CheckinTicket[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stale = false;
    // Wait for the organizer to stop typing before asking the API
    const timer = setTimeout(
      () => {
        getEventTickets(eventId, search)
          .then((list) => !stale && setTickets(list))
          .catch((err: Error) => !stale && setError(err));
      },
      search ? 300 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [eventId, search, reload]);

  const markPresent = async ({ id, participant }: CheckinTicket) => {
    setNotice(null);
    setPending(id);
    try {
      const updated = await checkIn(id);
      setTickets(
        (list) => list?.map((t) => (t.id === id ? updated : t)) ?? null,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Checked in from another device meanwhile: show the real state
        setNotice(`${participant.name} est déjà marqué(e) présent(e).`);
        setReload((n) => n + 1);
      } else if (err instanceof ApiError && err.status === 400) {
        setNotice(`Le billet de ${participant.name} est annulé.`);
        setReload((n) => n + 1);
      } else {
        setNotice(
          `Impossible de marquer ${participant.name} présent(e), réessayez.`,
        );
      }
    } finally {
      setPending(null);
    }
  };

  if (error instanceof ApiError && error.status === 403) {
    return (
      <p role="alert" className="alert-error">
        Accès refusé : vous ne gérez pas cet événement.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="alert-error">
        Impossible de charger les inscrits, réessayez plus tard.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        aria-label="Rechercher un inscrit"
        placeholder="Nom ou code du billet"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="field"
      />
      {notice && (
        <p role="status" className="alert-note">
          {notice}
        </p>
      )}
      {!tickets ? (
        <div aria-busy="true" className="space-y-3">
          <p className="sr-only">Chargement...</p>
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : tickets.length === 0 ? (
        <p className="card text-muted">Aucun inscrit trouvé.</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="card flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{ticket.participant.name}</p>
                <p className="text-sm break-all text-muted">
                  {ticket.participant.email} ·{' '}
                  <span className="font-mono">{ticket.code}</span>
                </p>
              </div>
              {ticket.status === 'CANCELLED' ? (
                <span className="badge">Billet annulé</span>
              ) : ticket.checkedInAt ? (
                <span className="badge badge-ok">
                  Présent depuis {formatTime(ticket.checkedInAt)}
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="badge badge-warn">Absent</span>
                  <button
                    type="button"
                    disabled={pending === ticket.id}
                    onClick={() => void markPresent(ticket)}
                    className="btn btn-primary"
                  >
                    Marquer présent
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
