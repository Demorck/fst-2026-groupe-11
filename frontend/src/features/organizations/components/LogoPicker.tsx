import { useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { alertDialog } from '../../../components/dialogs.ts';

const MAX_BYTES = 512 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Drop zone for the logo of an organization: shows what is there (or the chosen file), says what is
 * accepted, and takes a click or a dropped file. The checks only spare a round trip: the API checks again.
 */
export default function LogoPicker({
  current,
  file = null,
  onPick,
}: {
  /** What the organization has today: its logo, or its initials. */
  current: ReactNode;
  /** A file chosen but not sent yet (creation form): shown in place of `current`. */
  file?: File | null;
  onPick: (file: File) => void | Promise<void>;
}) {
  const [over, setOver] = useState(false);
  // jsdom has no object URLs. Not revoked: at most 512 Ko per pick, and StrictMode would revoke a live one
  const preview = useMemo(
    () => (file ? (URL.createObjectURL?.(file) ?? null) : null),
    [file],
  );

  async function choose(chosen: File | undefined) {
    if (!chosen) return;
    if (!TYPES.includes(chosen.type)) {
      void alertDialog({
        title: 'Format non pris en charge',
        message: 'Choisissez une image PNG, JPEG ou WebP.',
      });
    } else if (chosen.size > MAX_BYTES) {
      void alertDialog({
        title: 'Logo trop lourd',
        message: 'Le logo ne doit pas dépasser 512 Ko.',
      });
    } else {
      await onPick(chosen);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // the same file can be chosen again after a refusal
    event.target.value = '';
    void choose(chosen);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    void choose(event.dataTransfer.files[0]);
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand motion-safe:transition-colors ${
        over
          ? 'border-brand bg-brand-tint'
          : 'border-field bg-canvas/60 hover:border-brand-edge hover:bg-brand-tint/40'
      }`}
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          current
        )}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block font-semibold">Logo de l'organisation</span>
        <span className="block text-sm text-muted">
          {file
            ? file.name
            : 'Glissez une image ici ou cliquez pour parcourir vos fichiers.'}
        </span>
        <span className="block text-[13px] text-muted">
          PNG, JPEG ou WebP, 512 Ko maximum
        </span>
        <span className="btn btn-secondary btn-sm mt-1">
          {file ? 'Choisir un autre fichier' : 'Choisir un fichier'}
        </span>
      </span>
      <input
        type="file"
        accept={TYPES.join(',')}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}
