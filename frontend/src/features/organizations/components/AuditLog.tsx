import { useEffect, useState } from 'react';
import { getAudit } from '../api.ts';
import { translate } from '../messages.ts';
import type { AuditEntry } from '../types.ts';

const describe = ({ action, actor, target, details }: AuditEntry) => {
  const who = target?.name ?? 'quelqu’un';
  switch (action) {
    case 'MEMBER_REMOVED':
      return `${actor.name} a retiré ${who} de l'organisation`;
    case 'MEMBER_LEFT':
      return `${who} a quitté l'organisation`;
    case 'INVITATION_CANCELLED':
      return `${actor.name} a annulé l'invitation de ${who}`;
    case 'PARTICIPATION_REMOVED':
      return `${actor.name} a retiré ${who} de l'événement ${details?.eventTitle ?? ''}`.trim();
  }
};

/** Removals and cancelled invitations, newest first. For managers. */
export default function AuditLog({
  organizationId,
  refreshKey,
}: {
  organizationId: string;
  refreshKey: number;
}) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAudit(organizationId)
      .then(setEntries)
      .catch((err: Error) => setError(translate(err.message)));
  }, [organizationId, refreshKey]);

  return (
    <section aria-labelledby="audit" className="space-y-3">
      <h2 id="audit" className="text-xl font-semibold">
        Journal
      </h2>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {entries?.length === 0 && <p>Rien à signaler.</p>}
      <ul className="space-y-1 text-sm">
        {entries?.map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.createdAt} className="mr-2 text-muted">
              {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
            </time>
            {describe(entry)}
            {!!entry.details?.removedShifts && (
              <span className="text-muted">
                {' '}
                ({entry.details.removedShifts} créneau(x) à venir retiré(s))
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
