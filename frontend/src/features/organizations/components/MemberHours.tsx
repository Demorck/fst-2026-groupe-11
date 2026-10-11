import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getHours } from '../api.ts';
import { translate } from '../messages.ts';
import { STATUS_LABELS } from '../types.ts';
import type { HoursRow } from '../types.ts';

/** Volunteer hours (past shifts) with a link to each attestation. A volunteer only sees their own row. */
export default function MemberHours({
  organizationId,
}: {
  organizationId: string;
}) {
  const [rows, setRows] = useState<HoursRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHours(organizationId)
      .then(setRows)
      .catch((err: Error) => setError(translate(err.message)));
  }, [organizationId]);

  return (
    <section aria-labelledby="hours" className="space-y-3">
      <h2 id="hours" className="text-xl font-semibold">
        Heures de bénévolat
      </h2>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {!rows && !error && <p className="text-muted">Chargement...</p>}
      {rows?.length === 0 && (
        <p className="card text-muted">Aucun bénévole pour l'instant.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-canvas text-[13px] text-muted">
                <th className="px-4 py-3 font-semibold">Bénévole</th>
                <th className="px-4 py-3 font-semibold">Créneaux</th>
                <th className="px-4 py-3 font-semibold">Heures</th>
                <th className="px-4 py-3 font-semibold">Attestation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-line-soft">
                  <td className="px-4 py-2.5">
                    {row.name}
                    {row.status !== 'ACCEPTED' && (
                      <span className="ml-2 text-xs text-muted">
                        ({STATUS_LABELS[row.status].toLowerCase()})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{row.shifts}</td>
                  <td className="px-4 py-2.5">{row.hours} h</td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/organizations/${organizationId}/attestation/${row.userId}`}
                      aria-label={`Attestation de ${row.name}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
