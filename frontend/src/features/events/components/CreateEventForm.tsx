import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { getMyOrganizations } from '../../organizations/api.ts';
import type { MyOrganization } from '../../organizations/types.ts';
import { createEvent } from '../api.ts';
import { CATEGORY_LABELS, EVENT_CATEGORIES } from '../types.ts';
import type { EventCategory } from '../types.ts';

const fieldClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600';

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
      <p role="alert" className="text-red-600">
        {loadError}
      </p>
    );
  }
  if (!managed) return <p>Chargement...</p>;
  if (managed.length === 0) {
    return (
      <div className="min-w-0 flex-[999_1_520px] space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-7">
        <p className="font-semibold">
          Vous ne gérez aucune organisation pour l'instant.
        </p>
        <p>
          Un événement est toujours rattaché à une ou plusieurs organisations :
          créez la vôtre, ou acceptez l'invitation d'un autre gestionnaire,
          avant de créer un événement.
        </p>
        <Link
          to="/organizations"
          className="inline-block rounded-[10px] bg-indigo-600 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Gérer mes organisations
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 flex-[999_1_520px] space-y-5 rounded-xl border border-gray-200 bg-white p-7"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Organisations qui participent
        </legend>
        {managed.map(({ id, name }) => (
          <label key={id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={() => toggle(id)}
              className="size-4 accent-indigo-600"
            />
            {name}
          </label>
        ))}
      </fieldset>
      <TextField
        label="Titre"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Description</span>
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
        />
      </label>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Capacité"
          type="number"
          required
          min={1}
          step={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className={fieldClass}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField
        label="Image (URL, facultatif)"
        type="url"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-[10px] bg-indigo-600 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
        >
          {pending ? 'Création...' : "Créer l'événement"}
        </button>
        <Link
          to="/events"
          className="inline-flex min-h-12 items-center rounded-[10px] border border-gray-300 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
