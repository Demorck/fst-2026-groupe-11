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

  const totals = data.events.reduce(
    (sum, e) => ({
      reserved: sum.reserved + e.reserved,
      capacity: sum.capacity + e.capacity,
      required: sum.required + e.volunteers.required,
      registered: sum.registered + e.volunteers.registered,
    }),
    { reserved: 0, capacity: 0, required: 0, registered: 0 },
  );
  const missingVolunteers = totals.required > totals.registered;

  return (
    <div className="space-y-6">
      {data.organizations.length > 1 && (
        <div
          role="group"
          aria-label="Organisation"
          className="flex flex-wrap gap-2"
        >
          {[{ id: undefined, name: 'Toutes' }, ...data.organizations].map(
            ({ id, name }) => (
              <button
                key={id ?? 'all'}
                type="button"
                aria-pressed={organizationId === id}
                onClick={() => setOrganizationId(id)}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-field bg-white px-4 text-center text-sm font-medium aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
              >
                {name}
              </button>
            ),
          )}
        </div>
      )}

      {loading && <p className="text-muted">Chargement...</p>}
      {!loading && data.events.length === 0 && (
        <div className="card flex flex-col items-start gap-3 p-8">
          <p className="font-semibold">
            Aucun événement à suivre pour le moment.
          </p>
          <Link to="/events/new" className="btn btn-primary">
            Créer un événement
          </Link>
        </div>
      )}
      {!loading && data.events.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Événements à suivre" value={data.events.length} />
            <Stat
              label="Inscrits"
              value={totals.reserved}
              hint={`sur ${totals.capacity} places`}
            />
            <Stat
              label="Remplissage"
              value={percent(totals.reserved / Math.max(totals.capacity, 1))}
            />
            <Stat
              label="Couverture bénévoles"
              value={
                totals.required > 0
                  ? percent(totals.registered / totals.required)
                  : 'Aucun créneau'
              }
              hint={
                totals.required > 0
                  ? `${totals.registered} sur ${totals.required}`
                  : undefined
              }
              warn={missingVolunteers}
            />
          </dl>
          <div className="rounded-xl border border-line bg-white md:overflow-x-auto">
            <table className="w-full text-left text-[15px] max-md:block md:min-w-[820px]">
              <thead className="max-md:sr-only">
                <tr className="bg-canvas text-[13px] text-muted">
                  <th className="px-4 py-3.5 font-semibold">Événement</th>
                  <th className="px-4 py-3.5 font-semibold">Organisations</th>
                  <th className="px-4 py-3.5 font-semibold">Inscrits</th>
                  <th className="px-4 py-3.5 font-semibold">Présents</th>
                  <th className="px-4 py-3.5 font-semibold">Bénévoles</th>
                  <th className="px-4 py-3.5 font-semibold">À surveiller</th>
                  <th className="px-4 py-3.5 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {data.events.map((event) => {
                  const atRisk =
                    event.risks.lowFill || event.risks.incompleteShifts;
                  const open = opened === event.id;
                  return (
                    <Fragment key={event.id}>
                      <tr
                        className={`border-t border-line-soft align-top max-md:block max-md:space-y-3 max-md:p-4 ${atRisk ? 'bg-warn-bg/25' : ''}`}
                        data-at-risk={atRisk}
                      >
                        <td className={cell}>
                          <Link
                            to={`/events/${event.id}`}
                            className="font-semibold text-ink"
                          >
                            {event.title}
                          </Link>
                          <div className="text-sm text-muted">
                            {formatEventDate(event.startsAt)}
                          </div>
                        </td>
                        <td className={cell} data-label="Organisations">
                          <OrganizationBubbles
                            organizations={event.organizations}
                            max={3}
                          />
                        </td>
                        <td className={cell} data-label="Inscrits">
                          <ProgressBar
                            value={event.reserved}
                            max={event.capacity}
                            label={`Remplissage de ${event.title}`}
                            className={`mb-1.5 w-28 ${event.risks.lowFill ? 'progress-warn' : ''}`}
                          />
                          {event.reserved} / {event.capacity} (
                          {percent(event.fillRate)})
                        </td>
                        <td className={cell} data-label="Présents">
                          {event.checkedIn}
                        </td>
                        <td className={cell} data-label="Bénévoles">
                          {event.volunteers.required > 0
                            ? `${event.volunteers.registered} / ${event.volunteers.required}`
                            : '—'}
                        </td>
                        <td className={cell} data-label="À surveiller">
                          <Risks risks={event.risks} />
                        </td>
                        <td className={cell}>
                          <div className="flex flex-wrap gap-x-4 md:flex-nowrap">
                            <Link
                              to={`/events/${event.id}/shifts`}
                              aria-label={`Créneaux de ${event.title}`}
                              className="inline-flex min-h-11 items-center font-semibold"
                            >
                              Créneaux
                            </Link>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`Détail de ${event.title}`}
                              onClick={() => setOpened(open ? null : event.id)}
                              className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline"
                            >
                              {open ? 'Masquer' : 'Détail'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-line-soft bg-canvas max-md:block">
                          <td colSpan={7} className="px-4 py-3 max-md:block">
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
        </>
      )}
    </div>
  );
}

// Below md the table turns into cards: each cell shows its column name through data-label
const cell =
  'px-4 py-3.5 max-md:block max-md:p-0 max-md:before:mb-0.5 max-md:before:block max-md:before:text-xs max-md:before:text-muted max-md:before:content-[attr(data-label)]';

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`font-display text-3xl font-bold sm:text-4xl ${warn ? 'text-warn-ink' : ''}`}
      >
        {value}
      </dd>
      {hint && <dd className="text-sm text-muted">{hint}</dd>}
    </div>
  );
}
