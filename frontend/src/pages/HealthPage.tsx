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
    <div className="space-y-6">
      <h1 className="page-title">État de l'API</h1>
      {error && <p className="alert-error">Erreur : {error}</p>}
      {!error && !health && <p>Chargement...</p>}
      {health && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="card">
              <dt className="text-sm text-muted">État</dt>
              <dd>
                <span className="badge badge-ok">{health.status}</span>
              </dd>
            </div>
            <div className="card">
              <dt className="text-sm text-muted">Heure de la base</dt>
              <dd className="font-semibold">{health.databaseTime}</dd>
            </div>
            <div className="card">
              <dt className="text-sm text-muted">Utilisateurs</dt>
              <dd className="font-display text-2xl font-bold">
                {health.users}
              </dd>
            </div>
          </dl>
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">
              Réponse brute
            </summary>
            <pre className="mt-3 overflow-x-auto text-sm">
              {JSON.stringify(health, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
