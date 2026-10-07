import { apiFetch } from '../../api/client.ts';
import type { Ticket } from './types.ts';

export const reserveTicket = (eventId: string) =>
  apiFetch<Ticket>(`/events/${eventId}/tickets`, { method: 'POST' });
