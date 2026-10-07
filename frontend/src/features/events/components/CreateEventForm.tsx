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
      <div className="alert-note min-w-0 flex-[999_1_520px] space-y-3 p-7 text-base">
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
    <form
      onSubmit={onSubmit}
      className="card min-w-0 flex-[999_1_520px] space-y-5 p-6 sm:p-7"
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">
          Organisations qui participent
        </legend>
        {managed.map(({ id, name }) => (
          <label key={id} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={() => toggle(id)}
              className="size-5 accent-brand"
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
        <label className="field-label">
          <span>Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="field"
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
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-1">
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
  );
}
