import { useEffect, useState } from 'react';
import { getAttestation } from '../api.ts';
import { translate } from '../messages.ts';
import type { Attestation } from '../types.ts';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });

/** Volunteering attestation, laid out to be printed (the browser can save it as a PDF). */
export default function AttestationView({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAttestation(organizationId, userId)
      .then(setAttestation)
      .catch((err: Error) => setError(translate(err.message)));
  }, [organizationId, userId]);

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  if (!attestation) return <p>Chargement...</p>;

  const { organization, volunteer, totalHours, shifts, issuedAt } = attestation;

  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-xl border border-gray-200 bg-white p-8 print:border-0 print:p-0">
      <h1 className="text-3xl font-bold">Attestation de bénévolat</h1>
      <p>
        L'organisation <strong>{organization.name}</strong> atteste que{' '}
        <strong>{volunteer.name}</strong> a effectué{' '}
        <strong>{totalHours} heure(s)</strong> de bénévolat sur {shifts.length}{' '}
        créneau(x), détaillés ci-dessous.
      </p>
      {shifts.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Événement</th>
              <th className="py-2 pr-4 font-medium">Mission</th>
              <th className="py-2 font-medium">Heures</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr
                key={`${shift.eventId}-${shift.startsAt}`}
                className="border-b"
              >
                <td className="py-2 pr-4">{date(shift.startsAt)}</td>
                <td className="py-2 pr-4">{shift.eventTitle}</td>
                <td className="py-2 pr-4">{shift.shiftTitle}</td>
                <td className="py-2">{shift.hours} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-sm text-gray-600">Établie le {date(issuedAt)}.</p>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 print:hidden"
      >
        Imprimer
      </button>
    </article>
  );
}
