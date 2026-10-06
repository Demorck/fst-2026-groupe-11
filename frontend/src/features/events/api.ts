import { apiFetch } from '../../api/client.ts';
import type { CreateEventInput, EventDetail } from './types.ts';

export const createEvent = (input: CreateEventInput) =>
  apiFetch<EventDetail>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
