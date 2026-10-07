import { useEffect, useState } from 'react';
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
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  if (!stats) return <p>Chargement...</p>;
  if (stats.shifts.length === 0) {
    return <p>Aucun créneau bénévole pour cet événement.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {stats.shifts.map((shift) => (
        <li key={shift.id}>
          <strong>{shift.title}</strong> · {time(shift.startsAt)} :{' '}
          <span
            className={
              shift.registered < shift.requiredVolunteers
                ? 'font-medium text-amber-700'
                : 'text-green-700'
            }
          >
            {shift.registered} / {shift.requiredVolunteers} bénévoles
          </span>
        </li>
      ))}
    </ul>
  );
}
