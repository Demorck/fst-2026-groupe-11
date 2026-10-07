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
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!rows && !error && <p>Chargement...</p>}
      {rows?.length === 0 && <p>Aucun bénévole pour l'instant.</p>}
      {rows && rows.length > 0 && (
        <table className="w-full max-w-2xl text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="py-2 pr-4 font-medium">Bénévole</th>
              <th className="py-2 pr-4 font-medium">Créneaux</th>
              <th className="py-2 pr-4 font-medium">Heures</th>
              <th className="py-2 font-medium">Attestation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b">
                <td className="py-2 pr-4">
                  {row.name}
                  {row.status !== 'ACCEPTED' && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({STATUS_LABELS[row.status].toLowerCase()})
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{row.shifts}</td>
                <td className="py-2 pr-4">{row.hours} h</td>
                <td className="py-2">
                  <Link
                    to={`/organizations/${organizationId}/attestation/${row.userId}`}
                    aria-label={`Attestation de ${row.name}`}
                    className="text-indigo-700 underline"
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
