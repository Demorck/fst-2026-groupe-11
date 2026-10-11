import { useEffect, useState } from 'react';
import { getAttestation } from '../api.ts';
import { translate } from '../messages.ts';
import type { Attestation } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

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
      <p role="alert" className="alert-error">
        {error}
      </p>
    );
  }
  if (!attestation) return <p className="text-muted">Chargement...</p>;

  const { organization, volunteer, totalHours, shifts, issuedAt } = attestation;

  return (
    <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
      <article className="card space-y-8 p-8 [print-color-adjust:exact] sm:p-12 print:space-y-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-center gap-4 border-b-2 border-ink pb-6">
          <OrganizationLogo
            organization={organization}
            className="size-16 text-xl"
          />
          <p className="font-display text-2xl font-bold">{organization.name}</p>
        </div>
        <h1 className="text-center text-3xl font-bold">
          Attestation de bénévolat
        </h1>
        <p className="leading-relaxed">
          L'organisation <strong>{organization.name}</strong> atteste que{' '}
          <strong>{volunteer.name}</strong> a effectué{' '}
          <strong>{totalHours} heure(s)</strong> de bénévolat sur{' '}
          {shifts.length} créneau(x), détaillés ci-dessous.
        </p>
        {shifts.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink text-muted">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Événement</th>
                <th className="py-2 pr-4 font-medium">Mission</th>
                <th className="py-2 text-right font-medium">Heures</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr
                  key={`${shift.eventId}-${shift.startsAt}`}
                  className="border-b border-line-soft print:break-inside-avoid"
                >
                  <td className="py-2 pr-4">{date(shift.startsAt)}</td>
                  <td className="py-2 pr-4">{shift.eventTitle}</td>
                  <td className="py-2 pr-4">{shift.shiftTitle}</td>
                  <td className="py-2 text-right">{shift.hours} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-wrap items-end justify-between gap-8 pt-4 print:break-inside-avoid">
          <p className="text-sm text-muted">Établie le {date(issuedAt)}.</p>
          <div className="w-64 max-w-full text-sm">
            <p className="font-medium">Pour l'organisation</p>
            <div className="mt-2 h-24 rounded-lg border border-dashed border-field print:border-ink" />
          </div>
        </div>
      </article>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-primary print:hidden"
      >
        Imprimer
      </button>
    </div>
  );
}
