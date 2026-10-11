import { useEffect, useState } from 'react';
import ProgressBar from '../../../components/ProgressBar.tsx';
import { getEventStats } from '../api.ts';
import type { EventStats } from '../types.ts';

const time = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

/** Shift by shift coverage of one event. */
export default function StatsDetail({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEventStats(eventId)
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, [eventId]);

  if (error) {
    return (
      <p role="alert" className="alert-error">
        {error}
      </p>
    );
  }
  if (!stats) return <p>Chargement...</p>;
  if (stats.shifts.length === 0) {
    return <p>Aucun créneau bénévole pour cet événement.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stats.shifts.map((shift) => {
        const missing = shift.registered < shift.requiredVolunteers;
        return (
          <li
            key={shift.id}
            className="space-y-2 rounded-lg border border-line bg-white p-3 text-sm"
          >
            <p>
              <strong>{shift.title}</strong>
              <span className="block text-muted">{time(shift.startsAt)}</span>
            </p>
            <ProgressBar
              value={shift.registered}
              max={shift.requiredVolunteers}
              label={`Couverture de ${shift.title}`}
              className={missing ? 'progress-warn' : ''}
            />
            <span
              className={missing ? 'font-medium text-warn-ink' : 'text-ok-ink'}
            >
              {shift.registered} / {shift.requiredVolunteers} bénévoles
            </span>
          </li>
        );
      })}
    </ul>
  );
}
