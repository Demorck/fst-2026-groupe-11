import { useState } from 'react';

const base =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60';

/** A destructive action asks for a second click before it runs. */
export default function ConfirmButton({
  label,
  ariaLabel,
  question,
  onConfirm,
}: {
  label: string;
  /** Accessible name when several buttons share the same label on a page. */
  ariaLabel?: string;
  question: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={ariaLabel}
        className={`${base} border border-red-300 bg-white text-red-700`}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm">{question}</span>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onConfirm();
          } finally {
            setPending(false);
            setAsking(false);
          }
        }}
        className={`${base} bg-red-600 text-white`}
      >
        Confirmer
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(false)}
        className={`${base} border border-gray-300 bg-white`}
      >
        Annuler
      </button>
    </span>
  );
}
