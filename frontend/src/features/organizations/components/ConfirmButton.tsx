import { useState } from 'react';

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
        className={`btn btn-danger-outline text-sm`}
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
        className={`btn btn-danger text-sm`}
      >
        Confirmer
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(false)}
        className={`btn btn-secondary text-sm`}
      >
        Annuler
      </button>
    </span>
  );
}
