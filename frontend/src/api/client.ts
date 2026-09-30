/**
 * Calls the backend REST API and returns the parsed JSON body.
 * Paths are relative to `/api`, which Vite proxies to the NestJS server in dev.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    // Nest sends `message` as a string, or as a list for validation errors
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = [body?.message ?? []].flat().join(', ');
    throw new Error(message || `API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}
