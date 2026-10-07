import { clearSession, getToken } from '../features/auth/session.ts';

/** Non-2xx API response; `status` lets pages tell a 404 from other failures. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Calls the backend REST API and returns the parsed JSON body.
 * Paths are relative to `/api`, which Vite proxies to the NestJS server in dev.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init?.headers,
    },
  });
  // expired or revoked token: drop the session so the UI shows logged out
  if (res.status === 401 && token) clearSession();
  if (!res.ok) {
    // Nest sends `message` as a string, or as a list for validation errors
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = [body?.message ?? []].flat().join(', ');
    throw new ApiError(res.status, message || `API ${res.status} on ${path}`);
  }
  // 204 has no body (deletions)
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
