import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatEventDate } from '../../events/types.ts';
import OrganizationBubbles from '../../organizations/components/OrganizationBubbles.tsx';
import { getDashboard } from '../api.ts';
import type { DashboardData, EventIndicators } from '../types.ts';
import StatsDetail from './StatsDetail.tsx';

const percent = (rate: number) => `${Math.round(rate * 100)} %`;

function Risks({ risks }: { risks: EventIndicators['risks'] }) {
  if (!risks.lowFill && !risks.incompleteShifts) {
    return <span className="text-gray-500">Rien à signaler</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {risks.lowFill && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Peu rempli
        </span>
      )}
      {risks.incompleteShifts && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Créneaux incomplets
        </span>
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
      <p role="alert" className="text-red-600">
        Erreur : {error}
      </p>
    );
  }
  if (!result) return <p>Chargement...</p>;

  const { data, forOrganization } = result;
  const loading = forOrganization !== organizationId;

  if (data.organizations.length === 0) {
    return (
      <p>
        Vous ne gérez aucune organisation pour l'instant.{' '}
        <Link to="/organizations" className="text-indigo-700 underline">
          Gérer mes organisations
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-sm space-y-1">
        <span className="text-sm font-medium">Organisation</span>
        <select
          value={organizationId ?? ''}
          onChange={(e) => setOrganizationId(e.target.value || undefined)}
          className="block w-full rounded border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <option value="">Toutes mes organisations</option>
          {data.organizations.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {loading && <p>Chargement...</p>}
      {!loading && data.events.length === 0 && (
        <p>Aucun événement à suivre pour le moment.</p>
      )}
      {!loading && data.events.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="py-2 pr-4 font-medium">Événement</th>
              <th className="py-2 pr-4 font-medium">Organisations</th>
              <th className="py-2 pr-4 font-medium">Inscrits</th>
              <th className="py-2 pr-4 font-medium">Présents</th>
              <th className="py-2 pr-4 font-medium">Bénévoles</th>
              <th className="py-2 pr-4 font-medium">À surveiller</th>
              <th className="py-2 font-medium">
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
                    className={`border-b align-top ${atRisk ? 'bg-amber-50' : ''}`}
                    data-at-risk={atRisk}
                  >
                    <td className="py-2 pr-4">
                      <Link
                        to={`/events/${event.id}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {event.title}
                      </Link>
                      <div className="text-gray-600">
                        {formatEventDate(event.startsAt)}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <OrganizationBubbles
                        organizations={event.organizations}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {event.reserved} / {event.capacity} (
                      {percent(event.fillRate)})
                    </td>
                    <td className="py-2 pr-4">{event.checkedIn}</td>
                    <td className="py-2 pr-4">
                      {event.volunteers.required > 0
                        ? `${event.volunteers.registered} / ${event.volunteers.required}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <Risks risks={event.risks} />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`Détail de ${event.title}`}
                        onClick={() => setOpened(open ? null : event.id)}
                        className="text-indigo-700 underline"
                      >
                        {open ? 'Masquer' : 'Détail'}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b bg-gray-50">
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
      )}
    </div>
  );
}
