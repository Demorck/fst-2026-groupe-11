import { useEffect, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { getMyOrganizations } from '../../organizations/api.ts';
import type { MyOrganization } from '../../organizations/types.ts';
import { createEvent } from '../api.ts';
import EventPreview from './EventPreview.tsx';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  EVENT_CATEGORIES,
} from '../types.ts';
import type { EventCategory } from '../types.ts';

export default function CreateEventForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [category, setCategory] = useState<EventCategory>('CONFERENCE');
  const [imageUrl, setImageUrl] = useState('');
  // Organizations the author manages: an event always belongs to at least one of them
  const [managed, setManaged] = useState<MyOrganization[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const { submit, pending, error } = useSubmit(async () => {
    // datetime-local has no timezone, Date reads it as local time
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new Error('La fin doit être après le début.');
    }
    if (selected.length === 0) {
      throw new Error('Choisissez au moins une organisation.');
    }
    const event = await createEvent({
      title: title.trim(),
      description: description.trim(),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      location: location.trim(),
      capacity: Number(capacity),
      category,
      imageUrl: imageUrl.trim() || undefined,
      organizationIds: selected,
    });
    await navigate(`/events/${event.id}`);
  });

  useEffect(() => {
    getMyOrganizations()
      .then((mine) => {
        const mineManaged = mine.filter(({ role }) => role === 'MANAGER');
        setManaged(mineManaged);
        // A single organization needs no choice
        if (mineManaged.length === 1) setSelected([mineManaged[0].id]);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
    );

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
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
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Catégorie</legend>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map((c) => (
                <label
                  key={c}
                  className="chip has-[:checked]:border-(--ink) has-[:checked]:bg-(--tint) has-[:checked]:text-(--ink)"
                  style={
                    {
                      '--tint': CATEGORY_STYLES[c].tint,
                      '--ink': CATEGORY_STYLES[c].ink,
                    } as CSSProperties
                  }
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    className="sr-only"
                  />
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="space-y-5 border-t border-line-soft pt-6">
          <h2 className="text-lg font-semibold">Date et lieu</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Début"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <TextField
              label="Fin"
              type="datetime-local"
              required
              min={startsAt || undefined}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
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
          <div className="relative max-w-xs">
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
            </div>
          </fieldset>
          <TextField
            label="Image (URL, facultatif)"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </section>

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary min-h-12 px-5"
          >
            {pending ? 'Création...' : "Créer l'événement"}
          </button>
          <Link
            to="/events"
            className="btn btn-secondary min-h-12 px-5 font-normal"
          >
            Annuler
          </Link>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <p className="text-sm font-medium">Aperçu dans la liste</p>
        <EventPreview
          title={title}
          category={category}
          startsAt={startsAt}
          location={location}
          capacity={Number(capacity)}
        />
        <p className="alert-note">
          Les créneaux bénévoles se configurent après la création, depuis le
          dashboard.
        </p>
      </aside>
    </div>
  );
}
