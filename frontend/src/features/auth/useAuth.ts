import { login as loginRequest } from './api.ts';
import { clearSession, saveSession, useSession } from './session.ts';
import type { LoginInput } from './types.ts';

/** Current user with login and logout, shared across the app through the session store. */
export function useAuth() {
  const session = useSession();
  return {
    user: session?.user ?? null,
    login: async (input: LoginInput) => saveSession(await loginRequest(input)),
    logout: clearSession,
  };
}
