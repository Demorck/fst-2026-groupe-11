import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import type { Shift, ShiftInput } from '../types.ts';

// datetime-local reads and writes local time without a timezone
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

interface ShiftFormProps {
  /** Shift being edited, none to create a new one */
  shift?: Shift;
  onSave: (input: ShiftInput) => Promise<void>;
  onCancel: () => void;
}

export default function ShiftForm({ shift, onSave, onCancel }: ShiftFormProps) {
  const [title, setTitle] = useState(shift?.title ?? '');
  const [startsAt, setStartsAt] = useState(
    shift ? toLocalInput(shift.startsAt) : '',
  );
  const [endsAt, setEndsAt] = useState(shift ? toLocalInput(shift.endsAt) : '');
  const [required, setRequired] = useState(
    String(shift?.requiredVolunteers ?? ''),
  );
  const { submit, pending, error } = useSubmit(async () => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new Error('La fin doit être après le début.');
    }
    await onSave({
      title: title.trim(),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      requiredVolunteers: Number(required),
    });
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label={shift ? 'Modifier le créneau' : 'Nouveau créneau'}
      className="card space-y-4"
    >
      <h2 className="text-lg font-semibold">
        {shift ? 'Modifier le créneau' : 'Nouveau créneau'}
      </h2>
      <TextField
        label="Intitulé"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
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
        <TextField
          label="Bénévoles requis"
          type="number"
          required
          min={1}
          step={1}
          value={required}
          onChange={(e) => setRequired(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'Enregistrement...' : shift ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary font-normal"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
