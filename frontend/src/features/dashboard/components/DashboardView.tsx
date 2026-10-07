import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import ProgressBar from '../../../components/ProgressBar.tsx';
import { formatEventDate } from '../../events/types.ts';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import { getDashboard } from '../api.ts';
import type { DashboardData, EventIndicators } from '../types.ts';
import StatsDetail from './StatsDetail.tsx';

const percent = (rate: number) => `${Math.round(rate * 100)} %`;

function Risks({ risks }: { risks: EventIndicators['risks'] }) {
  if (!risks.lowFill && !risks.incompleteShifts) {
    return <span className="text-muted">Rien à signaler</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {risks.lowFill && <span className="badge badge-warn">Peu rempli</span>}
      {risks.incompleteShifts && (
        <span className="badge badge-warn">Créneaux incomplets</span>
      )}
    </span>
  );
}

/** Follow-up of the events of the organizations the user manages (step 5 of the journey). */
export default function DashboardView() {
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  // The answer remembers which filter it is for: no reset in an effect, "loading" is derived
  const [result, setResult] = useState<{
    forOrganization: string | undefined;
    data: DashboardData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    getDashboard(organizationId)
      .then((data) => setResult({ forOrganization: organizationId, data }))
      .catch((err: Error) => setError(err.message));
  }, [organizationId]);

  if (error) {
    return (
      <p role="alert" className="alert-error">
        Erreur : {error}
      </p>
    );
  }
  if (!result) return <p className="text-muted">Chargement...</p>;

  const { data, forOrganization } = result;
  const loading = forOrganization !== organizationId;

  if (data.organizations.length === 0) {
    return (
      <p className="card text-muted">
        Vous ne gérez aucune organisation pour l'instant.{' '}
        <Link to="/organizations" className="font-semibold underline">
          Gérer mes organisations
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="field-label max-w-sm">
        <span>Organisation</span>
        <select
          value={organizationId ?? ''}
          onChange={(e) => setOrganizationId(e.target.value || undefined)}
          className="field"
        >
          <option value="">Toutes mes organisations</option>
          {data.organizations.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {loading && <p className="text-muted">Chargement...</p>}
      {!loading && data.events.length === 0 && (
        <p className="card text-muted">
          Aucun événement à suivre pour le moment.
        </p>
      )}
      {!loading && data.events.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[820px] text-left text-[15px]">
            <thead>
              <tr className="bg-canvas text-[13px] text-muted">
                <th className="px-4 py-3.5 font-semibold">Événement</th>
                <th className="px-4 py-3.5 font-semibold">Organisations</th>
                <th className="px-4 py-3.5 font-semibold">Inscrits</th>
                <th className="px-4 py-3.5 font-semibold">Présents</th>
                <th className="px-4 py-3.5 font-semibold">Bénévoles</th>
                <th className="px-4 py-3.5 font-semibold">À surveiller</th>
                <th className="px-4 py-3.5 font-semibold">
                  <span className="sr-only">Détail</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => {
                const atRisk =
                  event.risks.lowFill || event.risks.incompleteShifts;
                const open = opened === event.id;
                return (
                  <Fragment key={event.id}>
                    <tr
                      className={`border-t border-line-soft align-top ${atRisk ? 'bg-warn-bg/40' : ''}`}
                      data-at-risk={atRisk}
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/events/${event.id}`}
                          className="font-semibold text-ink hover:text-brand hover:underline"
                        >
                          {event.title}
                        </Link>
                        <div className="text-sm text-muted">
                          {formatEventDate(event.startsAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <OrganizationBubbles
                          organizations={event.organizations}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <ProgressBar
                          value={event.reserved}
                          max={event.capacity}
                          label={`Remplissage de ${event.title}`}
                          className="mb-1.5 w-28"
                        />
                        {event.reserved} / {event.capacity} (
                        {percent(event.fillRate)})
                      </td>
                      <td className="px-4 py-3.5">{event.checkedIn}</td>
                      <td className="px-4 py-3.5">
                        {event.volunteers.required > 0
                          ? `${event.volunteers.registered} / ${event.volunteers.required}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Risks risks={event.risks} />
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`Détail de ${event.title}`}
                          onClick={() => setOpened(open ? null : event.id)}
                          className="inline-flex min-h-11 items-center font-semibold underline"
                        >
                          {open ? 'Masquer' : 'Détail'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line-soft bg-canvas">
                        <td colSpan={7} className="px-4 py-3">
                          <StatsDetail eventId={event.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
