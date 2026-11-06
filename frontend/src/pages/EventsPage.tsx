import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listUpcomingEvents } from '../features/events/api.ts';
import { useDataVersion } from '../features/tickets/store.ts';
import CategoryChips from '../features/events/components/CategoryChips.tsx';
import EventCard from '../features/events/components/EventCard.tsx';
import type {
  EventCategory,
  EventWithSeats,
} from '../features/events/types.ts';

// ?period=<key>: events starting between `from` and `to` days from now, same bounds as the groups
const PERIODS: Record<string, { label: string; from: number; to: number }> = {
  week: { label: 'Cette semaine', from: 0, to: 7 },
  month: { label: 'Dans le mois', from: 0, to: 31 },
  later: { label: 'Plus tard', from: 31, to: Infinity },
};

export default function EventsPage() {
  // ?organization=<id>: the events of one organization (link from its public page)
  const organizationId = useSearchParams()[0].get('organization') ?? undefined;

  // key: another filter starts from a fresh state instead of resetting it in an effect
  return (
    <EventsList key={organizationId ?? 'all'} organizationId={organizationId} />
  );
}

function EventsList({ organizationId }: { organizationId?: string }) {
  useDocumentTitle('Événements');
  const [events, setEvents] = useState<EventWithSeats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A booking or a cancellation elsewhere changes the seats: read the list again
  const version = useDataVersion();
  const [query, setQuery] = useState('');
  const [now] = useState(Date.now);
  // Filters live in the URL so that a filtered list can be shared or reloaded
  const [params, setParams] = useSearchParams();
  const category = params.get('category') as EventCategory | null;
  const period = PERIODS[params.get('period') ?? ''];
  const setFilters = (filters: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(filters)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    // An older answer must not overwrite a newer one
    let stale = false;
    listUpcomingEvents(organizationId)
      .then((list) => {
        if (stale) return;
        setEvents(list);
        setError(null);
      })
      .catch((err: Error) => !stale && setError(err.message));
    return () => {
      stale = true;
    };
  }, [organizationId, version]);

  const organization = events
    ?.flatMap((event) => event.organizations)
    .find(({ id }) => id === organizationId);

  const needle = query.trim().toLowerCase();
  const shown = events?.filter(
    (event) =>
      (!category || event.category === category) &&
      (!period ||
        ((Date.parse(event.startsAt) - now) / 864e5 > period.from &&
          (Date.parse(event.startsAt) - now) / 864e5 <= period.to)) &&
      (!needle ||
        `${event.title} ${event.location}`.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Événements à venir</h1>
          <p className="page-subtitle">
            Réservez votre place aux événements des associations du campus.
          </p>
        </div>
        <input
          type="search"
          aria-label="Rechercher un événement"
          placeholder="Titre ou lieu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field sm:max-w-xs"
        />
      </div>
      {events && events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <CategoryChips
            name="category-filter"
            legend=""
            value={category}
            onChange={(c) => setFilters({ category: c })}
            allLabel="Toutes"
          />
          <div className="flex items-center gap-4">
            <select
              aria-label="Période"
              value={params.get('period') ?? ''}
              onChange={(e) => setFilters({ period: e.target.value })}
              className="field w-auto"
            >
              <option value="">Toutes les dates</option>
              {Object.entries(PERIODS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">
              {shown?.length} événement(s)
            </span>
          </div>
        </div>
      )}
      {organizationId && (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="badge badge-brand px-3 py-1 text-sm">
            Organisation : {organization?.name ?? '...'}
          </span>
          <Link
            to="/"
            aria-label="Retirer le filtre par organisation"
            className="inline-flex min-h-11 items-center text-muted underline"
          >
            ✕ Tous les événements
          </Link>
        </p>
      )}
      {error && <p className="alert-error">Erreur : {error}</p>}
      {!error && !events && (
        <div
          aria-busy="true"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5"
        >
          <p className="sr-only">Chargement...</p>
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      )}
      {events?.length === 0 && (
        <p className="card text-muted">
          Aucun événement à venir pour le moment.
        </p>
      )}
      {events && events.length > 0 && shown?.length === 0 && (
        <div className="card flex flex-col items-start gap-3 p-8">
          <p className="font-semibold">
            Aucun événement ne correspond à votre recherche.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setQuery('');
              setFilters({ category: null, period: null });
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
      {shown && shown.length > 0 && (
        <EventGroups
          events={shown}
          grouped={!category && !period && !needle && shown.length >= 4}
        />
      )}
    </div>
  );
}

const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5';

/** From four events on, the next one is featured and the others are grouped by how soon they come. */
function EventGroups({
  events,
  grouped,
}: {
  events: EventWithSeats[];
  grouped: boolean;
}) {
  const [now] = useState(Date.now);
  if (!grouped) {
    return (
      <ul className={GRID}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </ul>
    );
  }

  const [next, ...others] = events;
  const week = now + 7 * 864e5;
  const month = now + 31 * 864e5;
  const groups = [
    {
      title: 'Cette semaine',
      items: others.filter((e) => Date.parse(e.startsAt) <= week),
    },
    {
      title: 'Dans le mois',
      items: others.filter(
        (e) => Date.parse(e.startsAt) > week && Date.parse(e.startsAt) <= month,
      ),
    },
    {
      title: 'Plus tard',
      items: others.filter((e) => Date.parse(e.startsAt) > month),
    },
  ].filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-8">
      <ul className={GRID}>
        <EventCard event={next} featured />
      </ul>
      {groups.map(({ title, items }) => (
        <section key={title} className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold">{title}</h2>
            <span className="text-sm text-muted tabular-nums">
              {items.length}
            </span>
          </div>
          <ul className={GRID}>
            {items.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
