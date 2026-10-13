import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { getMyOrganizations } from '../../organizations/api.ts';
import type { MyOrganization } from '../../organizations/types.ts';
import { createEvent, updateEvent } from '../api.ts';
import DateTimeField from '../../../components/DateTimeField.tsx';
import { fromIso } from '../../../components/dateTime.ts';
import { EVENT_ERRORS } from '../messages.ts';
import CategoryChips from './CategoryChips.tsx';
import EventPreview from './EventPreview.tsx';
import type { EventCategory, EventWithAccess } from '../types.ts';

/** Creates an event, or edits `event` when given (fields filled in from it). */
export default function CreateEventForm({
  event,
}: {
  event?: EventWithAccess;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(
    event ? fromIso(event.startsAt) : '',
  );
  const [endsAt, setEndsAt] = useState(event ? fromIso(event.endsAt) : '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [capacity, setCapacity] = useState(event ? String(event.capacity) : '');
  const [category, setCategory] = useState<EventCategory>(
    event?.category ?? 'CONFERENCE',
  );
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? '');
  // Organizations the author manages: an event always belongs to at least one of them
  const [managed, setManaged] = useState<MyOrganization[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(
    event?.organizations.map(({ id }) => id) ?? [],
  );
  const { submit, pending, error } = useSubmit(async () => {
    // datetime-local has no timezone, Date reads it as local time
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Saisissez des dates valides.');
    }
    if (end <= start) {
      throw new Error('La fin doit être après le début.');
    }
    if (selected.length === 0) {
      throw new Error('Choisissez au moins une organisation.');
    }
    const input = {
      title: title.trim(),
      description: description.trim(),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      location: location.trim(),
      capacity: Number(capacity),
      category,
      imageUrl: imageUrl.trim() || undefined,
      organizationIds: selected,
    };
    const saved = event
      ? await updateEvent(event.id, input)
      : await createEvent(input);
    await navigate(`/events/${saved.id}`);
  });

  useEffect(() => {
    getMyOrganizations()
      .then((mine) => {
        const mineManaged = mine.filter(({ role }) => role === 'MANAGER');
        setManaged(mineManaged);
        // A single organization needs no choice
        if (!event && mineManaged.length === 1) {
          setSelected([mineManaged[0].id]);
        }
      })
      .catch((err: Error) => setLoadError(err.message));
  }, [event]);

  // Co-organizers the user does not manage stay on the event, shown but locked
  const others =
    event?.organizations.filter(
      ({ id }) => !managed?.some((organization) => organization.id === id),
    ) ?? [];

  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
    );

  function onSubmit(e: SyntheticEvent) {
    e.preventDefault();
    void submit();
  }

  if (loadError) {
    return (
      <p role="alert" className="alert-error">
        {loadError}
      </p>
    );
  }
  if (!managed) return <p className="text-muted">Chargement...</p>;
  if (managed.length === 0) {
    return (
      <div className="alert-note max-w-2xl space-y-3 p-7 text-base">
        <p className="font-semibold">
          Vous ne gérez aucune organisation pour l'instant.
        </p>
        <p>
          Un événement est toujours rattaché à une ou plusieurs organisations :
          créez la vôtre, ou acceptez l'invitation d'un autre gestionnaire,
          avant de créer un événement.
        </p>
        <Link to="/organizations" className="btn btn-primary">
          Gérer mes organisations
        </Link>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={onSubmit} className="card space-y-8 p-6 sm:p-7">
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">L'essentiel</h2>
          <TextField
            label="Titre"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="field-label">
            <span>Description</span>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field"
            />
          </label>
          <CategoryChips
            name="category"
            legend="Catégorie"
            value={category}
            onChange={(c) => c && setCategory(c)}
          />
        </section>

        <section className="space-y-5 border-t border-line-soft pt-6">
          <h2 className="text-lg font-semibold">Date et lieu</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField
              label="Début"
              required
              value={startsAt}
              onChange={setStartsAt}
            />
            <DateTimeField
              label="Fin"
              required
              min={startsAt || undefined}
              value={endsAt}
              onChange={setEndsAt}
            />
          </div>
          <TextField
            label="Lieu"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </section>

        <section className="space-y-5 border-t border-line-soft pt-6">
          <h2 className="text-lg font-semibold">Public et organisation</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="relative">
              <TextField
                label="Capacité"
                type="number"
                required
                min={1}
                step={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-10 bottom-2.5 text-sm text-muted"
              >
                places
              </span>
            </div>
            <TextField
              label="Image (URL, facultatif)"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">
              Organisations qui participent
            </legend>
            <div className="flex flex-wrap gap-2">
              {managed.map(({ id, name }) => (
                <label key={id} className="chip">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={() => toggle(id)}
                    className="sr-only"
                  />
                  {name}
                </label>
              ))}
              {others.map(({ id, name }) => (
                <label key={id} className="chip opacity-60">
                  <input type="checkbox" checked disabled className="sr-only" />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {error && (
          <p role="alert" className="alert-error">
            {EVENT_ERRORS[error] ?? error}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary min-h-12 px-5"
          >
            {event
              ? pending
                ? 'Enregistrement...'
                : 'Enregistrer les modifications'
              : pending
                ? 'Création...'
                : "Créer l'événement"}
          </button>
          <Link
            to={event ? `/events/${event.id}` : '/events'}
            className="btn btn-secondary min-h-12 px-5 font-normal"
          >
            Annuler
          </Link>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <p className="text-sm font-medium">Aperçu dans la liste</p>
        <EventPreview
          title={title}
          category={category}
          startsAt={startsAt}
          location={location}
          capacity={Number(capacity)}
        />
        {!event && (
          <p className="alert-note">
            Les créneaux bénévoles se configurent après la création, depuis le
            dashboard.
          </p>
        )}
      </aside>
    </div>
  );
}
