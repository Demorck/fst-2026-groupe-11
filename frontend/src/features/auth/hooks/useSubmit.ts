import { useState } from 'react';

/** Runs a form action with pending and error state, the error being the API message. */
export function useSubmit(action: () => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, error };
}
