import { apiFetch } from '../../api/client.ts';
import type { CreateEventInput, EventDetail, EventWithSeats } from './types.ts';

export const createEvent = (input: CreateEventInput) =>
  apiFetch<EventDetail>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** Events starting from now, soonest first. */
export const listUpcomingEvents = () =>
  apiFetch<EventWithSeats[]>(
    `/events?from=${encodeURIComponent(new Date().toISOString())}`,
  );

export const getEvent = (id: string) =>
  apiFetch<EventWithSeats>(`/events/${encodeURIComponent(id)}`);
