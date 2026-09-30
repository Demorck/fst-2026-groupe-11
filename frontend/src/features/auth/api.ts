import { apiFetch } from '../../api/client.ts';
import type { LoginInput, LoginResponse, RegisterInput } from './types.ts';

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});

export const register = (input: RegisterInput) =>
  apiFetch<unknown>('/auth/register', post(input));

export const login = (input: LoginInput) =>
  apiFetch<LoginResponse>('/auth/login', post(input));
