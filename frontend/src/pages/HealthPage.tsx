import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client.ts';

interface Health {
  status: string;
  databaseTime: string;
  users: number;
}

export default function HealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>('/health')
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">État de l'API</h1>
      {error && <p className="text-red-600">Erreur : {error}</p>}
      {!error && !health && <p>Chargement...</p>}
      {health && (
        <pre className="rounded bg-white p-4 shadow">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
    </div>
  );
}
