import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { createEvent } from '../api.ts';
import { CATEGORY_LABELS, EVENT_CATEGORIES } from '../types.ts';
import type { EventCategory } from '../types.ts';

const fieldClass =
  'block w-full rounded border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600';

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
  const { submit, pending, error } = useSubmit(async () => {
    // datetime-local has no timezone, Date reads it as local time
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new Error('La fin doit être après le début.');
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
    });
    await navigate(`/events/${event.id}`);
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
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
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
      >
        {pending ? 'Création...' : "Créer l'événement"}
      </button>
    </form>
  );
}
