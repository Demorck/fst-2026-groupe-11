import { useState } from 'react';
import { confirm } from './dialogs.ts';

/** A destructive action asks for a confirmation in a modal before it runs. */
export default function ConfirmButton({
  label,
  ariaLabel,
  question,
  details,
  compact = false,
  onConfirm,
}: {
  label: string;
  /** Accessible name when several buttons share the same label on a page. */
  ariaLabel?: string;
  /** Title of the modal. */
  question: string;
  /** What will happen, under the question. */
  details?: string;
  /** Smaller button, for a card. */
  compact?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);

  async function ask() {
    if (!(await confirm({ title: question, message: details }))) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void ask()}
      disabled={pending}
      aria-label={ariaLabel}
      className={`btn btn-danger-outline text-sm ${compact ? 'btn-sm' : ''}`}
    >
      {label}
    </button>
  );
}
