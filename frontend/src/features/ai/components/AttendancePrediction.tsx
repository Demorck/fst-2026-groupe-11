import { useEffect, useState } from 'react';
import type { EventCategory } from '../../events/types.ts';
import { predictAttendance } from '../api.ts';
import type { AttendancePredictionResult } from '../types.ts';

const CONFIDENCE = {
  LOW: { label: 'Confiance faible', badge: 'badge badge-warn' },
  MEDIUM: { label: 'Confiance moyenne', badge: 'badge' },
  HIGH: { label: 'Confiance élevée', badge: 'badge badge-ok' },
} as const;

// Wait for the organizer to stop typing before asking the API
const DEBOUNCE_MS = 500;

interface Answer {
  key: string;
  prediction?: AttendancePredictionResult;
  error?: string;
}

/** Estimates the attendance of the event being created, from the history of similar events. */
export default function AttendancePrediction({
  category,
  startsAt,
  capacity,
}: {
  category: EventCategory;
  /** Local `YYYY-MM-DDTHH:mm`, as the form keeps it */
  startsAt: string;
  capacity: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const seats = Number(capacity);
  const start = new Date(startsAt);
  const ready =
    !Number.isNaN(start.getTime()) && Number.isInteger(seats) && seats >= 1;
  // An answer only counts for the inputs it was asked for: anything else is still loading
  const key = `${category}|${startsAt}|${capacity}|${attempt}`;

  useEffect(() => {
    if (!ready) return;
    let stale = false;
    const timer = setTimeout(() => {
      predictAttendance({
        category,
        startsAt: new Date(startsAt).toISOString(),
        capacity: Number(capacity),
      })
        .then((prediction) => !stale && setAnswer({ key, prediction }))
        .catch(
          (err: Error) => !stale && setAnswer({ key, error: err.message }),
        );
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [ready, key, category, startsAt, capacity]);

  const current = answer?.key === key ? answer : null;

  return (
    <section
      aria-label="Estimation de l'affluence"
      aria-live="polite"
      className="space-y-3"
    >
      {!ready ? (
        <p className="text-sm text-muted">
          Renseignez la date de début et la capacité pour estimer l'affluence.
        </p>
      ) : !current ? (
        <div aria-busy="true" className="skeleton h-24">
          <p className="sr-only">Estimation en cours...</p>
        </div>
      ) : current.error ? (
        <div className="alert-note flex flex-wrap items-center justify-between gap-3">
          <p>Estimation indisponible : {current.error}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : (
        current.prediction && (
          <Estimate prediction={current.prediction} capacity={seats} />
        )
      )}
    </section>
  );
}

function Estimate({
  prediction: { estimate, fillRate, confidence, sampleSize, warning },
  capacity,
}: {
  prediction: AttendancePredictionResult;
  capacity: number;
}) {
  if (estimate === null || fillRate === null) {
    return (
      <p className="text-sm text-muted">
        Pas encore d'événement passé pour estimer l'affluence.
      </p>
    );
  }
  const { label, badge } = CONFIDENCE[confidence];
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-brand-edge bg-brand-tint/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Affluence estimée</p>
          <span className={badge}>{label}</span>
        </div>
        <p className="font-display text-2xl font-bold">
          environ {estimate} billets{' '}
          <span className="text-base font-normal text-muted">
            sur {capacity} ({Math.round(fillRate * 100)} %)
          </span>
        </p>
        <p className="text-sm text-muted">
          {sampleSize > 0
            ? `Calculé d'après ${sampleSize} événement${sampleSize > 1 ? 's' : ''} passé${sampleSize > 1 ? 's' : ''} de la même catégorie.`
            : "Aucun événement passé de cette catégorie : l'estimation vient des autres catégories."}
        </p>
      </div>
      {warning && (
        <p role="status" className="alert-note">
          {warning.message}
        </p>
      )}
    </div>
  );
}
