import { apiFetch } from '../../api/client.ts';
import type {
  CreateEventInput,
  EventDetail,
  EventWithAccess,
  EventWithSeats,
} from './types.ts';

export const createEvent = (input: CreateEventInput) =>
  apiFetch<EventDetail>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** Events starting from now, soonest first. */
export const listUpcomingEvents = (organizationId?: string) =>
  apiFetch<EventWithSeats[]>(
    `/events?from=${encodeURIComponent(new Date().toISOString())}${
      organizationId
        ? `&organizationId=${encodeURIComponent(organizationId)}`
        : ''
    }`,
  );

export const getEvent = (id: string) =>
  apiFetch<EventWithAccess>(`/events/${encodeURIComponent(id)}`);

/** Only the fields sent change; `organizationIds` replaces the list, `imageUrl: null` clears the image. */
export const updateEvent = (
  id: string,
  input: Partial<Omit<CreateEventInput, 'imageUrl'>> & {
    imageUrl?: string | null;
  },
) =>
  apiFetch<EventWithAccess>(`/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteEvent = (id: string) =>
  apiFetch<void>(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
